import { POSITION_FALLBACKS, type Position } from "@/lib/positions";
import type { FormationSlot, LineupAssignments } from "./schema";

/**
 * 자동 배치. 동네 축구의 우선순위대로:
 *   1) 출전 시간이 고르게 — 자리보다 많이 오면 덜 뛴 사람부터 뛴다.
 *   2) 골키퍼는 골키퍼가 — GK가 가능한 사람끼리 돌아가며 막고, GK만 하는 사람을 필드로 돌리지 않는다.
 *   3) 그 안에서 포지션이 맞게 — 정확한 포지션 → 비슷한 포지션 → 그래도 남으면 아무 자리.
 * 아무도 GK가 안 되면 필드 선수 중 GK를 덜 본 사람이 골문에 선다 (빈 골문으로 두지 않는다).
 */
export type LineupPlayer = { id: string; positions: Position[] };

export type SlotFit = "primary" | "fallback" | "off";

/** 선수가 슬롯에 얼마나 맞는지: 가능 포지션(primary) / 유사 포지션(fallback) / 불가(off) */
export function getSlotFit(slot: Pick<FormationSlot, "position">, player: LineupPlayer): SlotFit {
  if (player.positions.includes(slot.position)) return "primary";
  const fallbacks = POSITION_FALLBACKS[slot.position];
  if (player.positions.some((p) => fallbacks.includes(p))) return "fallback";
  return "off";
}

type Counts = ReadonlyMap<string, number>;

export type AutoLineupOptions = {
  /** 다른 쿼터에서 이미 뛴 쿼터 수. 적은 사람이 먼저 뛴다. */
  appearances?: Counts;
  /** 다른 쿼터에서 GK를 본 수. GK가 가능한 사람끼리 돌아가며 막는다. */
  keeperDuty?: Counts;
  /** 이 쿼터 뒤로 더 뛸 수 있는 쿼터 수. 조퇴 등으로 적은 사람이 같은 조건이면 먼저 뛴다. */
  remaining?: Counts;
};

const countOf = (counts: Counts | undefined, id: string) => counts?.get(id) ?? 0;
const canKeep = (p: LineupPlayer) => p.positions.includes("GK");
const isPureKeeper = (p: LineupPlayer) => p.positions.length > 0 && p.positions.every((pos) => pos === "GK");

/**
 * 슬롯 후보 선수 목록(우선순위 순).
 * 정확한 포지션 → (allowFallback이면) 유사 포지션. 같은 등급 안에서는 덜 뛴 사람 → 선수 본인의 선호 순서.
 * GK 슬롯은 GK를 덜 본 사람이 먼저다.
 */
function rankCandidates(
  slot: FormationSlot,
  players: readonly LineupPlayer[],
  allowFallback: boolean,
  { appearances, keeperDuty }: AutoLineupOptions,
): string[] {
  const load = (id: string) => (slot.position === "GK" ? countOf(keeperDuty, id) : countOf(appearances, id));

  const primary = players
    .map((p) => ({ id: p.id, rank: p.positions.indexOf(slot.position) }))
    .filter((c) => c.rank >= 0)
    .sort((a, b) => load(a.id) - load(b.id) || a.rank - b.rank);
  if (!allowFallback) return primary.map((c) => c.id);

  const primaryIds = new Set(primary.map((c) => c.id));
  const fallbacks = POSITION_FALLBACKS[slot.position];
  const secondary: { id: string; fallbackRank: number; preference: number }[] = [];
  for (const player of players) {
    if (primaryIds.has(player.id)) continue;
    let best: { fallbackRank: number; preference: number } | undefined;
    for (const [preference, pos] of player.positions.entries()) {
      const fallbackRank = fallbacks.indexOf(pos);
      if (fallbackRank >= 0 && (!best || fallbackRank < best.fallbackRank)) best = { fallbackRank, preference };
    }
    if (best) secondary.push({ id: player.id, ...best });
  }
  secondary.sort((a, b) => load(a.id) - load(b.id) || a.fallbackRank - b.fallbackRank || a.preference - b.preference);
  return [...primary.map((c) => c.id), ...secondary.map((c) => c.id)];
}

type Pairing = { slotOf: Map<string, string>; playerOf: Map<string, string> };

/**
 * 이분 매칭(Kuhn, 증가 경로)으로 채운 자리 수를 늘린다. 이미 맺어진 짝은 유지한다.
 * 후보가 적은 자리부터 처리해 GK처럼 대체가 어려운 자리를 먼저 확보한다.
 */
function augment(
  slots: readonly FormationSlot[],
  players: readonly LineupPlayer[],
  allowFallback: boolean,
  options: AutoLineupOptions,
  pairing: Pairing,
) {
  const candidates = new Map(slots.map((s) => [s.id, rankCandidates(s, players, allowFallback, options)]));
  const order = [...slots].sort((a, b) => candidates.get(a.id)!.length - candidates.get(b.id)!.length);
  const tryAssign = (slotId: string, visited: Set<string>): boolean => {
    for (const playerId of candidates.get(slotId)!) {
      if (visited.has(playerId)) continue;
      visited.add(playerId);
      const current = pairing.slotOf.get(playerId);
      if (current === undefined || tryAssign(current, visited)) {
        pairing.slotOf.set(playerId, slotId);
        pairing.playerOf.set(slotId, playerId);
        return true;
      }
    }
    return false;
  };
  for (const slot of order) if (!pairing.playerOf.has(slot.id)) tryAssign(slot.id, new Set());
}

/** 정확한 포지션 → 유사 포지션까지만 맞춘다 (남는 사람은 그대로 남긴다). */
function matchByPosition(slots: readonly FormationSlot[], players: readonly LineupPlayer[], options: AutoLineupOptions): Pairing {
  const pairing: Pairing = { slotOf: new Map(), playerOf: new Map() };
  augment(slots, players, false, options, pairing);
  augment(slots, players, true, options, pairing);
  return pairing;
}

/**
 * 뛸 사람이 정해진 뒤 자리에 세운다. 정확한 포지션 → 유사 포지션 → 남은 사람은 남은 자리 아무 데나.
 * 골문이 비면 남은 사람 중 GK를 덜 본 사람을 세운다.
 */
export function assignSlots(
  slots: readonly FormationSlot[],
  players: readonly LineupPlayer[],
  options: AutoLineupOptions = {},
): LineupAssignments {
  const pairing = matchByPosition(slots, players, options);
  const leftovers = players.filter((p) => !pairing.slotOf.has(p.id));
  const empty = slots.filter((s) => !pairing.playerOf.has(s.id));

  const goal = empty.find((s) => s.position === "GK");
  if (goal && leftovers.length > 0) {
    leftovers.sort((a, b) => countOf(options.keeperDuty, a.id) - countOf(options.keeperDuty, b.id));
    pairing.playerOf.set(goal.id, leftovers.shift()!.id);
  }
  for (const slot of empty) {
    if (pairing.playerOf.has(slot.id)) continue;
    const next = leftovers.shift();
    if (!next) break;
    pairing.playerOf.set(slot.id, next.id);
  }
  return Object.fromEntries(slots.map((s) => [s.id, pairing.playerOf.get(s.id) ?? null]));
}

/**
 * 자리보다 사람이 많을 때 필드에 설 사람을 고른다.
 * 공평함(덜 뛴 순, 같으면 남은 기회가 적은 순)이 같은 사람끼리 묶어 앞에서부터 통째로 넣고,
 * 경계에 걸친 묶음에서만 빈 자리에 포지션이 맞는 사람을 고른다. → 공평함이 먼저, 포지션은 그다음.
 */
function pickFair(
  slots: readonly FormationSlot[],
  sorted: readonly LineupPlayer[],
  need: number,
  options: AutoLineupOptions,
): LineupPlayer[] {
  const key = (p: LineupPlayer) => `${countOf(options.appearances, p.id)}|${countOf(options.remaining, p.id)}`;
  const chosen: LineupPlayer[] = [];
  let i = 0;
  while (i < sorted.length && chosen.length < need) {
    let j = i;
    while (j < sorted.length && key(sorted[j]) === key(sorted[i])) j++;
    const group = sorted.slice(i, j);
    if (chosen.length + group.length <= need) chosen.push(...group);
    else chosen.push(...pickByFit(slots, chosen, group, need - chosen.length));
    i = j;
  }
  return chosen;
}

/** 이미 고른 사람으로 못 채운 자리에 정확히 맞는 사람 → 비슷하게 맞는 사람 → 나머지(공평 순서) 순으로 k명 */
function pickByFit(
  slots: readonly FormationSlot[],
  chosen: readonly LineupPlayer[],
  group: readonly LineupPlayer[],
  k: number,
): LineupPlayer[] {
  const filled = matchByPosition(slots, chosen, {});
  const empty = slots.filter((s) => !filled.playerOf.has(s.id));
  const pairing: Pairing = { slotOf: new Map(), playerOf: new Map() };
  augment(empty, group, false, {}, pairing);
  const exact = group.filter((p) => pairing.slotOf.has(p.id));
  augment(empty, group, true, {}, pairing);
  const similar = group.filter((p) => pairing.slotOf.has(p.id) && !exact.includes(p));
  const rest = group.filter((p) => !pairing.slotOf.has(p.id));
  return [...exact, ...similar, ...rest].slice(0, k);
}

/**
 * 한 쿼터 자동 배치. players는 이 쿼터에 뛸 수 있는 사람(늦참·조퇴는 미리 거른다).
 * 사람이 자리 수 이하면 모두 뛴다. 많으면 GK를 먼저 정하고, 필드는 pickFair로 공평하게 고른다.
 */
export function buildAutoLineup(
  slots: readonly FormationSlot[],
  players: readonly LineupPlayer[],
  options: AutoLineupOptions = {},
): LineupAssignments {
  if (players.length <= slots.length) return assignSlots(slots, players, options);

  const order = new Map(players.map((p, i) => [p.id, i]));
  const fairness = (a: LineupPlayer, b: LineupPlayer) =>
    countOf(options.appearances, a.id) - countOf(options.appearances, b.id) ||
    countOf(options.remaining, a.id) - countOf(options.remaining, b.id) ||
    order.get(a.id)! - order.get(b.id)!;

  const goal = slots.find((s) => s.position === "GK");
  const keeper = goal
    ? players
        .filter(canKeep)
        .sort(
          (a, b) =>
            countOf(options.keeperDuty, a.id) - countOf(options.keeperDuty, b.id) ||
            a.positions.indexOf("GK") - b.positions.indexOf("GK") ||
            fairness(a, b),
        )[0]
    : undefined;

  const fieldSlots = keeper ? slots.filter((s) => s !== goal) : slots;
  const pool = players.filter((p) => p !== keeper);
  // GK만 하는 사람은 필드로 돌리지 않는다 (사람이 모자랄 때만 예외).
  const fieldPool = pool.filter((p) => !isPureKeeper(p));
  const candidates = [...(fieldPool.length >= fieldSlots.length ? fieldPool : pool)].sort(fairness);
  const field = pickFair(fieldSlots, candidates, fieldSlots.length, options);

  const assignments = assignSlots(fieldSlots, field, options);
  if (keeper && goal) assignments[goal.id] = keeper.id;
  // 원래 슬롯 순서대로 돌려준다.
  return Object.fromEntries(slots.map((s) => [s.id, assignments[s.id] ?? null]));
}
