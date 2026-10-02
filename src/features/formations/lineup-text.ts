import type { Player } from "@/features/players/schema";
import { canPlayQuarter, displayName, quarterLabel, type FormationShape, type PlayerAvailability, type FormationSlot, type LineupAssignments, type QuarterLineup } from "./schema";
import { getSlots } from "./templates";

type Options = {
  title?: string;
  shape: FormationShape;
  assignments: LineupAssignments;
  bench: Player[];
  playersById: ReadonlyMap<string, Player>;
};

/**
 * 카톡방에 붙여 넣을 수 있는 텍스트 라인업 (한 쿼터).
 * 공격(맨 위 줄)부터 골키퍼(맨 아래 줄) 순서, 한 줄 안에서는 왼쪽 → 오른쪽.
 */
export function formatLineupText({ title, shape, assignments, bench, playersById }: Options): string {
  const rows = new Map<number, FormationSlot[]>();
  for (const slot of getSlots(shape)) {
    rows.set(slot.row, [...(rows.get(slot.row) ?? []), slot]);
  }

  const lines = [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, slots]) =>
      [...slots]
        .sort((a, b) => a.x - b.x)
        .map((slot) => {
          const playerId = assignments[slot.id];
          const player = playerId ? playersById.get(playerId) : undefined;
          const name = player ? displayName(player) : undefined;
          return `${slot.position} ${name ?? "(빈자리)"}`;
        })
        .join(" / "),
    );

  const out = [title ? `${title} (${shape})` : shape, ...lines];
  if (bench.length > 0) out.push(`벤치: ${bench.map(displayName).join(", ")}`);
  return out.join("\n");
}

type QuartersOptions = {
  title?: string;
  quarters: readonly QuarterLineup[];
  /** 참석 선수 순서. 쿼터별 벤치는 여기서 배치되지 않은 선수다. */
  attendingIds: readonly string[];
  playersById: ReadonlyMap<string, Player>;
  /** 늦참·조퇴: 그 쿼터에 못 뛰는 사람은 벤치에서도 뺀다 */
  availability?: PlayerAvailability;
};

/** 1~4쿼터를 한 번에. 쿼터마다 한 덩어리씩, 빈 줄로 구분한다. */
export function formatQuartersText({ title, quarters, attendingIds, playersById, availability = {} }: QuartersOptions): string {
  const attending = attendingIds.map((id) => playersById.get(id)).filter((p): p is Player => p !== undefined);

  const blocks = quarters.map((quarter, index) => {
    const assigned = new Set(Object.values(quarter.assignments));
    return formatLineupText({
      title: quarterLabel(index),
      shape: quarter.shape,
      assignments: quarter.assignments,
      bench: attending.filter((p) => !assigned.has(p.id) && canPlayQuarter(availability[p.id], index)),
      playersById,
    });
  });

  return [...(title ? [title] : []), ...blocks].join("\n\n");
}
