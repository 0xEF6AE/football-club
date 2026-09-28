import { z } from "zod";
import type { Player } from "@/features/players/schema";
import { buildAutoLineup } from "./auto-lineup";
import {
  FORMATION_SHAPES,
  QUARTER_COUNT,
  type FormationShape,
  type LineupAssignments,
  type QuarterLineup,
  type SavedFormation,
} from "./schema";
import { getSlots, normalizeAssignments } from "./templates";

/**
 * 포메이션 빌더의 상태 머신.
 * 한 경기는 1~4쿼터로 나뉘고 쿼터마다 라인업(모양 + 배치)을 따로 짠다. 참석 선수는 네 쿼터가 공유한다.
 * 컴포넌트는 "탭" 이벤트만 보내고, 선택 → 교체/배치/해제 규칙은 전부 여기서 결정한다.
 * 자리 조작(모양 바꾸기, 탭, 비우기, 자동 배치)은 모두 activeQuarter에만 적용된다.
 * 순수 함수라 UI 없이도 테스트할 수 있다.
 */
export type LineupSelection = { kind: "slot"; slotId: string } | { kind: "bench"; playerId: string };

export type LineupState = {
  quarters: QuarterLineup[];
  /** 지금 편집 중인 쿼터 (0 = 1쿼터) */
  activeQuarter: number;
  attendingIds: string[];
  selection: LineupSelection | null;
  /** 불러온 저장본 id. 저장 시 "덮어쓰기" 대상. */
  loadedId: string | null;
};

export type LineupAction =
  | { type: "setQuarter"; index: number }
  | { type: "setShape"; shape: FormationShape }
  | { type: "toggleAttending"; playerId: string }
  | { type: "setAllAttending"; playerIds: string[] }
  /** 지금 쿼터만 자동 배치. 다른 쿼터에서 적게 뛴 선수를 먼저 세운다. */
  | { type: "autoAssign"; players: Player[] }
  /** 1쿼터부터 4쿼터까지 차례로 자동 배치. 앞 쿼터에서 쉰 선수가 뒤 쿼터에 먼저 들어간다. */
  | { type: "autoAssignAll"; players: Player[] }
  /** 다른 쿼터의 모양과 배치를 지금 쿼터로 복사 */
  | { type: "copyQuarter"; from: number }
  | { type: "tapSlot"; slotId: string }
  | { type: "tapBench"; playerId: string }
  | { type: "clearSlot"; slotId: string }
  | { type: "clearSelection" }
  | { type: "clearAll" }
  | { type: "load"; formation: SavedFormation; validPlayerIds: ReadonlySet<string> }
  | { type: "markSaved"; id: string };

const DEFAULT_SHAPE: FormationShape = "4-2-3-1";

export function emptyQuarter(shape: FormationShape = DEFAULT_SHAPE): QuarterLineup {
  return { shape, assignments: normalizeAssignments(shape, {}) };
}

export function createInitialLineup(players: Player[]): LineupState {
  return {
    quarters: Array.from({ length: QUARTER_COUNT }, () => emptyQuarter()),
    activeQuarter: 0,
    attendingIds: players.map((p) => p.id),
    selection: null,
    loadedId: null,
  };
}

export function activeLineup(state: LineupState): QuarterLineup {
  return state.quarters[state.activeQuarter];
}

/** 선수별로 몇 쿼터에 배치돼 있는지 */
export function countAppearances(quarters: readonly QuarterLineup[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const quarter of quarters) {
    for (const playerId of Object.values(quarter.assignments)) {
      if (playerId) counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
  }
  return counts;
}

function normalizeQuarters(quarters: readonly QuarterLineup[], attending: ReadonlySet<string>): QuarterLineup[] {
  return quarters.map((q) => ({ shape: q.shape, assignments: normalizeAssignments(q.shape, q.assignments, attending) }));
}

function replaceQuarter(state: LineupState, index: number, quarter: QuarterLineup): LineupState {
  return {
    ...state,
    quarters: state.quarters.map((q, i) => (i === index ? quarter : q)),
    selection: null,
  };
}

function withAssignments(state: LineupState, assignments: LineupAssignments): LineupState {
  return replaceQuarter(state, state.activeQuarter, { ...activeLineup(state), assignments });
}

function place(state: LineupState, slotId: string, playerId: string): LineupState {
  const next: LineupAssignments = { ...activeLineup(state).assignments };
  // 같은 선수가 다른 자리에 있었다면 그 자리는 비운다.
  for (const [id, assigned] of Object.entries(next)) {
    if (assigned === playerId) next[id] = null;
  }
  next[slotId] = playerId;
  return withAssignments(state, next);
}

function swap(state: LineupState, a: string, b: string): LineupState {
  if (a === b) return { ...state, selection: null };
  const current = activeLineup(state).assignments;
  const next = { ...current, [a]: current[b] ?? null, [b]: current[a] ?? null };
  return withAssignments(state, next);
}

function isQuarterIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < QUARTER_COUNT;
}

export function lineupReducer(state: LineupState, action: LineupAction): LineupState {
  switch (action.type) {
    case "setQuarter": {
      if (!isQuarterIndex(action.index) || action.index === state.activeQuarter) return state;
      return { ...state, activeQuarter: action.index, selection: null };
    }

    case "setShape": {
      const current = activeLineup(state);
      if (action.shape === current.shape) return state;
      return replaceQuarter(state, state.activeQuarter, {
        shape: action.shape,
        // 같은 id의 슬롯(cb1, gk 등)은 선수를 이어받고, 사라진 슬롯의 선수는 벤치로 간다.
        assignments: normalizeAssignments(action.shape, current.assignments),
      });
    }

    case "toggleAttending": {
      const attending = new Set(state.attendingIds);
      if (attending.has(action.playerId)) attending.delete(action.playerId);
      else attending.add(action.playerId);
      return {
        ...state,
        attendingIds: [...attending],
        quarters: normalizeQuarters(state.quarters, attending),
        selection: null,
      };
    }

    case "setAllAttending": {
      const attending = new Set(action.playerIds);
      return {
        ...state,
        attendingIds: [...attending],
        quarters: normalizeQuarters(state.quarters, attending),
        selection: null,
      };
    }

    case "autoAssign": {
      const attending = new Set(state.attendingIds);
      const candidates = action.players.filter((p) => attending.has(p.id));
      const others = state.quarters.filter((_, i) => i !== state.activeQuarter);
      const { shape } = activeLineup(state);
      return withAssignments(
        state,
        buildAutoLineup(getSlots(shape), candidates, { appearances: countAppearances(others) }),
      );
    }

    case "autoAssignAll": {
      const attending = new Set(state.attendingIds);
      const candidates = action.players.filter((p) => attending.has(p.id));
      const built: QuarterLineup[] = [];
      for (const quarter of state.quarters) {
        built.push({
          shape: quarter.shape,
          assignments: buildAutoLineup(getSlots(quarter.shape), candidates, { appearances: countAppearances(built) }),
        });
      }
      return { ...state, quarters: built, selection: null };
    }

    case "copyQuarter": {
      if (!isQuarterIndex(action.from) || action.from === state.activeQuarter) return state;
      const source = state.quarters[action.from];
      return replaceQuarter(state, state.activeQuarter, { shape: source.shape, assignments: { ...source.assignments } });
    }

    case "tapSlot": {
      const { selection } = state;
      if (!selection) return { ...state, selection: { kind: "slot", slotId: action.slotId } };
      if (selection.kind === "slot") return swap(state, selection.slotId, action.slotId);
      return place(state, action.slotId, selection.playerId);
    }

    case "tapBench": {
      const { selection } = state;
      if (selection?.kind === "slot") return place(state, selection.slotId, action.playerId);
      if (selection?.kind === "bench" && selection.playerId === action.playerId) {
        return { ...state, selection: null };
      }
      return { ...state, selection: { kind: "bench", playerId: action.playerId } };
    }

    case "clearSlot":
      return withAssignments(state, { ...activeLineup(state).assignments, [action.slotId]: null });

    case "clearSelection":
      return state.selection ? { ...state, selection: null } : state;

    case "clearAll":
      return withAssignments(state, normalizeAssignments(activeLineup(state).shape, {}));

    case "load": {
      const { formation, validPlayerIds } = action;
      const attending = new Set(formation.attendingIds.filter((id) => validPlayerIds.has(id)));
      return {
        quarters: normalizeQuarters(formation.quarters, attending),
        activeQuarter: 0,
        attendingIds: [...attending],
        selection: null,
        loadedId: formation.id,
      };
    }

    case "markSaved":
      return { ...state, loadedId: action.id };
  }
}

/** 브라우저에 임시 저장하는 작업 중 상태. 선택(selection)은 저장하지 않는다. */
export const lineupDraftSchema = z.object({
  quarters: z
    .array(z.object({ shape: z.enum(FORMATION_SHAPES), assignments: z.record(z.string(), z.string().nullable()) }))
    .length(QUARTER_COUNT),
  activeQuarter: z.number().int().min(0).max(QUARTER_COUNT - 1),
  attendingIds: z.array(z.string()),
  loadedId: z.string().nullable(),
});

export type LineupDraft = z.infer<typeof lineupDraftSchema>;

export function toDraft(state: LineupState): LineupDraft {
  const { quarters, activeQuarter, attendingIds, loadedId } = state;
  return { quarters, activeQuarter, attendingIds, loadedId };
}

/** 임시 저장본 복원. 형식이 깨졌거나(옛 단일 라인업 형식 포함) 사라진 선수는 걸러내고, 복원할 게 없으면 null. */
export function restoreLineup(players: Player[], raw: unknown): LineupState | null {
  const parsed = lineupDraftSchema.safeParse(raw);
  if (!parsed.success) return null;
  const valid = new Set(players.map((p) => p.id));
  const attending = new Set(parsed.data.attendingIds.filter((id) => valid.has(id)));
  return {
    quarters: normalizeQuarters(parsed.data.quarters, attending),
    activeQuarter: parsed.data.activeQuarter,
    attendingIds: [...attending],
    selection: null,
    loadedId: parsed.data.loadedId,
  };
}

/** 참석했지만 지금 쿼터에 자리가 없는 선수 */
export function selectBench(state: LineupState, players: Player[]): Player[] {
  const assigned = new Set(Object.values(activeLineup(state).assignments));
  const attending = new Set(state.attendingIds);
  return players.filter((p) => attending.has(p.id) && !assigned.has(p.id));
}
