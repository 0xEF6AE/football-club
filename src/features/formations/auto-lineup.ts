import { POSITION_FALLBACKS, type Position } from "@/lib/positions";
import type { FormationSlot, LineupAssignments } from "./schema";

export type LineupPlayer = { id: string; positions: Position[] };

export type SlotFit = "primary" | "fallback" | "off";

/** 선수가 슬롯에 얼마나 맞는지: 가능 포지션(primary) / 유사 포지션(fallback) / 불가(off) */
export function getSlotFit(slot: Pick<FormationSlot, "position">, player: LineupPlayer): SlotFit {
  if (player.positions.includes(slot.position)) return "primary";
  const fallbacks = POSITION_FALLBACKS[slot.position];
  if (player.positions.some((p) => fallbacks.includes(p))) return "fallback";
  return "off";
}

export type AutoLineupOptions = {
  /**
   * 선수별 "이미 뛴 쿼터 수". 자리를 놓고 경쟁할 때 적게 뛴 선수를 먼저 세워
   * 쿼터를 거듭할수록 출전 시간이 고르게 돌아가게 한다. 없으면 선호 순서만 본다.
   */
  appearances?: ReadonlyMap<string, number>;
};

/**
 * 슬롯 후보 선수 목록(우선순위 순).
 * 1) 해당 포지션이 가능한 선수 — 적게 뛴 선수 → 선수 본인의 선호 순서(positions 배열 앞쪽) 순
 * 2) allowFallback이면 유사 포지션 선수 — 적게 뛴 선수 → 대체 우선순위 → 선수 선호 순서
 * 출전 수는 같은 등급(정확/유사) 안에서만 순서를 바꾼다. 공정하자고 GK를 ST에 세우지는 않는다.
 */
function rankCandidates(
  slot: FormationSlot,
  players: LineupPlayer[],
  allowFallback: boolean,
  appearances: ReadonlyMap<string, number>,
): string[] {
  const played = (id: string) => appearances.get(id) ?? 0;

  const primary = players
    .map((p) => ({ id: p.id, rank: p.positions.indexOf(slot.position) }))
    .filter((c) => c.rank >= 0)
    .sort((a, b) => played(a.id) - played(b.id) || a.rank - b.rank);

  if (!allowFallback) return primary.map((c) => c.id);

  const primaryIds = new Set(primary.map((c) => c.id));
  const fallbacks = POSITION_FALLBACKS[slot.position];
  const secondary: { id: string; fallbackRank: number; preference: number }[] = [];

  for (const player of players) {
    if (primaryIds.has(player.id)) continue;
    let best: { fallbackRank: number; preference: number } | undefined;
    for (const [preference, pos] of player.positions.entries()) {
      const fallbackRank = fallbacks.indexOf(pos);
      if (fallbackRank >= 0 && (!best || fallbackRank < best.fallbackRank)) {
        best = { fallbackRank, preference };
      }
    }
    if (best) secondary.push({ id: player.id, ...best });
  }
  secondary.sort(
    (a, b) => played(a.id) - played(b.id) || a.fallbackRank - b.fallbackRank || a.preference - b.preference,
  );

  return [...primary.map((c) => c.id), ...secondary.map((c) => c.id)];
}

/**
 * 참석 선수를 포메이션 슬롯에 자동 배치한다.
 *
 * 이분 매칭(Kuhn's algorithm, 증가 경로 탐색)으로 "채워지는 슬롯 수"를 최대화한다.
 * - 1차: 정확히 가능한 포지션만으로 매칭
 * - 2차: 1차 결과를 유지한 채 유사 포지션(fallback)까지 허용해 빈 슬롯을 추가로 채움
 * 후보가 적은(희소한) 슬롯부터 처리해 GK처럼 대체가 어려운 자리가 먼저 확보되도록 한다.
 * 채우지 못한 슬롯은 null로 남는다.
 * options.appearances를 주면 적게 뛴 선수를 먼저 세운다 (쿼터 로테이션용).
 */
export function buildAutoLineup(
  slots: FormationSlot[],
  players: LineupPlayer[],
  options: AutoLineupOptions = {},
): LineupAssignments {
  const appearances = options.appearances ?? new Map<string, number>();
  const slotOfPlayer = new Map<string, string>();
  const playerOfSlot = new Map<string, string>();

  const runMatching = (allowFallback: boolean) => {
    const candidates = new Map(slots.map((s) => [s.id, rankCandidates(s, players, allowFallback, appearances)]));
    const order = [...slots].sort(
      (a, b) => (candidates.get(a.id)?.length ?? 0) - (candidates.get(b.id)?.length ?? 0),
    );

    const tryAssign = (slotId: string, visited: Set<string>): boolean => {
      for (const playerId of candidates.get(slotId) ?? []) {
        if (visited.has(playerId)) continue;
        visited.add(playerId);

        const currentSlot = slotOfPlayer.get(playerId);
        if (currentSlot === undefined || tryAssign(currentSlot, visited)) {
          slotOfPlayer.set(playerId, slotId);
          playerOfSlot.set(slotId, playerId);
          return true;
        }
      }
      return false;
    };

    for (const slot of order) {
      if (!playerOfSlot.has(slot.id)) tryAssign(slot.id, new Set());
    }
  };

  runMatching(false);
  runMatching(true);

  return Object.fromEntries(slots.map((s) => [s.id, playerOfSlot.get(s.id) ?? null]));
}
