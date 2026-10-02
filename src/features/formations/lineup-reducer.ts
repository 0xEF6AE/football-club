import { z } from "zod";
import type { Player } from "@/features/players/schema";
import { buildAutoLineup } from "./auto-lineup";
import {
  availabilitySchema,
  canPlayQuarter,
  FORMATION_SHAPES,
  formationGuestSchema,
  normalizeQuarterList,
  QUARTER_COUNT,
  type FormationGuest,
  type FormationShape,
  type LineupAssignments,
  type PlayerAvailability,
  type QuarterLineup,
  type SavedFormation,
  guestAsPlayer,
} from "./schema";
import { getSlots, normalizeAssignments } from "./templates";

/**
 * 포메이션 빌더의 상태 머신.
 * 한 경기는 1~4쿼터로 나뉘고 쿼터마다 라인업(모양 + 배치)을 따로 짠다. 참석 선수는 네 쿼터가 공유한다.
 * 컴포넌트는 "탭" 이벤트만 보내고, 선택 → 교체/배치/해제 규칙은 전부 여기서 결정한다.
 * 자리 조작(모양 바꾸기, 탭, 비우기, 자동 배치)은 모두 activeQuarter에만 적용된다.
 * 참석자마다 뛸 수 있는 쿼터(늦참·조퇴, availability)가 있고, 자동 배치는 그 쿼터에만 세운다.
 * 용병(guests)은 선수 목록에 없는 사람이라 상태에 함께 들고 다니며, 액션의 players에는 용병까지 합친 명단을 넘긴다.
 * 순수 함수라 UI 없이도 테스트할 수 있다.
 */
export type LineupSelection = { kind: "slot"; slotId: string } | { kind: "bench"; playerId: string };

export type LineupState = {
  quarters: QuarterLineup[];
  /** 지금 편집 중인 쿼터 (0 = 1쿼터) */
  activeQuarter: number;
  attendingIds: string[];
  /** 참석자별 뛸 수 있는 쿼터. 없는 사람은 네 쿼터 모두. */
  availability: PlayerAvailability;
  /** 이 라인업에 넣은 용병 */
  guests: FormationGuest[];
  selection: LineupSelection | null;
  /** 불러온 저장본 id. 저장 시 "덮어쓰기" 대상. */
  loadedId: string | null;
};

export type LineupAction =
  | { type: "setQuarter"; index: number }
  | { type: "setShape"; shape: FormationShape }
  | { type: "toggleAttending"; playerId: string }
  | { type: "setAllAttending"; playerIds: string[] }
  /** 경기 참석 투표에서 가져오기: 참석자, 뛸 수 있는 쿼터, 용병을 한꺼번에 바꾼다 */
  | { type: "importMatch"; playerIds: string[]; availability: PlayerAvailability; guests: FormationGuest[] }
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
    availability: {},
    guests: [],
    selection: null,
    loadedId: null,
  };
}

/** 이 사람이 이 쿼터에 뛸 수 있는지 (늦참·조퇴) */
export function isAvailable(state: Pick<LineupState, "availability">, playerId: string, quarter: number): boolean {
  return canPlayQuarter(state.availability[playerId], quarter);
}

/** 쿼터별 GK를 본 수 */
export function countKeeperDuty(quarters: readonly QuarterLineup[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const quarter of quarters) {
    for (const slot of getSlots(quarter.shape)) {
      const playerId = quarter.assignments[slot.id];
      if (slot.position === "GK" && playerId) counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
  }
  return counts;
}

/** availability에서 참석자가 아닌 사람·제한 없는 사람은 지운다 */
function cleanAvailability(availability: PlayerAvailability, attending: ReadonlySet<string>): PlayerAvailability {
  const result: PlayerAvailability = {};
  for (const [id, quarters] of Object.entries(availability)) {
    const normalized = normalizeQuarterList(quarters);
    if (attending.has(id) && normalized) result[id] = normalized;
  }
  return result;
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
        availability: cleanAvailability(state.availability, attending),
        quarters: normalizeQuarters(state.quarters, attending),
        selection: null,
      };
    }

    case "setAllAttending": {
      // 용병은 "전체 선택/해제"와 상관없이 남긴다 (용병은 그 경기 참석자로 온 사람).
      const attending = new Set([...action.playerIds, ...state.guests.map((g) => g.id)]);
      return {
        ...state,
        attendingIds: [...attending],
        availability: cleanAvailability(state.availability, attending),
        quarters: normalizeQuarters(state.quarters, attending),
        selection: null,
      };
    }

    case "importMatch": {
      const guests = action.guests;
      const attending = new Set([...action.playerIds, ...guests.map((g) => g.id)]);
      return {
        ...state,
        attendingIds: [...attending],
        guests,
        availability: cleanAvailability(action.availability, attending),
        quarters: normalizeQuarters(state.quarters, attending),
        selection: null,
      };
    }

    case "autoAssign": {
      const attending = new Set(state.attendingIds);
      const q = state.activeQuarter;
      const candidates = action.players.filter((p) => attending.has(p.id) && isAvailable(state, p.id, q));
      const others = state.quarters.filter((_, i) => i !== q);
      const { shape } = activeLineup(state);
      return withAssignments(
        state,
        buildAutoLineup(getSlots(shape), candidates, {
          appearances: countAppearances(others),
          keeperDuty: countKeeperDuty(others),
        }),
      );
    }

    case "autoAssignAll": {
      // 1쿼터부터 차례로: 덜 뛴 사람·GK를 덜 본 사람이 먼저, 같으면 뒤에 뛸 기회가 적은(조퇴) 사람이 먼저.
      const attending = action.players.filter((p) => state.attendingIds.includes(p.id));
      const built: QuarterLineup[] = [];
      state.quarters.forEach((quarter, q) => {
        const remaining = new Map(
          attending.map((p) => [
            p.id,
            state.quarters.filter((_, later) => later > q && isAvailable(state, p.id, later)).length,
          ]),
        );
        built.push({
          shape: quarter.shape,
          assignments: buildAutoLineup(
            getSlots(quarter.shape),
            attending.filter((p) => isAvailable(state, p.id, q)),
            { appearances: countAppearances(built), keeperDuty: countKeeperDuty(built), remaining },
          ),
        });
      });
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
      const guests = formation.guests ?? [];
      const valid = new Set([...validPlayerIds, ...guests.map((g) => g.id)]);
      const attending = new Set(formation.attendingIds.filter((id) => valid.has(id)));
      return {
        quarters: normalizeQuarters(formation.quarters, attending),
        activeQuarter: 0,
        attendingIds: [...attending],
        availability: cleanAvailability(formation.availability ?? {}, attending),
        guests: guests.filter((g) => attending.has(g.id)),
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
  // 예전 임시 저장본에는 없어서 기본값을 둔다
  availability: availabilitySchema.catch({}).default({}),
  guests: z.array(formationGuestSchema).catch([]).default([]),
  loadedId: z.string().nullable(),
});

export type LineupDraft = z.infer<typeof lineupDraftSchema>;

export function toDraft(state: LineupState): LineupDraft {
  const { quarters, activeQuarter, attendingIds, availability, guests, loadedId } = state;
  return { quarters, activeQuarter, attendingIds, availability, guests, loadedId };
}

/** 임시 저장본 복원. 형식이 깨졌거나(옛 단일 라인업 형식 포함) 사라진 선수는 걸러내고, 복원할 게 없으면 null. */
export function restoreLineup(players: Player[], raw: unknown): LineupState | null {
  const parsed = lineupDraftSchema.safeParse(raw);
  if (!parsed.success) return null;
  const guests = parsed.data.guests;
  const valid = new Set([...players.map((p) => p.id), ...guests.map((g) => g.id)]);
  const attending = new Set(parsed.data.attendingIds.filter((id) => valid.has(id)));
  return {
    quarters: normalizeQuarters(parsed.data.quarters, attending),
    activeQuarter: parsed.data.activeQuarter,
    attendingIds: [...attending],
    availability: cleanAvailability(parsed.data.availability, attending),
    guests: guests.filter((g) => attending.has(g.id)),
    selection: null,
    loadedId: parsed.data.loadedId,
  };
}

/** 참석했고 지금 쿼터에 뛸 수 있는데 자리가 없는 사람 */
export function selectBench(state: LineupState, players: Player[]): Player[] {
  const assigned = new Set(Object.values(activeLineup(state).assignments));
  const attending = new Set(state.attendingIds);
  return players.filter(
    (p) => attending.has(p.id) && !assigned.has(p.id) && isAvailable(state, p.id, state.activeQuarter),
  );
}

/** 참석했지만 지금 쿼터에는 못 뛰는 사람 (늦참·조퇴) */
export function selectUnavailable(state: LineupState, players: Player[]): Player[] {
  const attending = new Set(state.attendingIds);
  return players.filter((p) => attending.has(p.id) && !isAvailable(state, p.id, state.activeQuarter));
}

/** 선수 목록 + 이 라인업의 용병을 한 명단으로 (액션의 players, 화면의 이름 찾기에 쓴다) */
export function rosterOf(state: Pick<LineupState, "guests">, players: Player[]): Player[] {
  return [...players, ...state.guests.map(guestAsPlayer)];
}
