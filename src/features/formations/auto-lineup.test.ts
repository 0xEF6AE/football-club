import { describe, expect, it } from "vitest";
import type { Position } from "@/lib/positions";
import { buildAutoLineup, getSlotFit, type LineupPlayer } from "./auto-lineup";
import type { FormationSlot, LineupAssignments } from "./schema";
import { getSlots } from "./templates";

const player = (id: string, positions: Position[]): LineupPlayer => ({ id, positions });
const slot = (id: string, position: Position): FormationSlot => ({ id, position, x: 0, y: 0, row: 0 });

describe("buildAutoLineup: 자리에 세우기", () => {
  it("정확히 맞는 선수가 있으면 모든 자리를 채운다", () => {
    const slots = getSlots("4-2-3-1");
    const players = slots.map((s, i) => player(`p${i}`, [s.position]));
    const result = buildAutoLineup(slots, players);
    for (const s of slots) expect(players.find((p) => p.id === result[s.id])?.positions).toContain(s.position);
  });

  it("같은 선수를 두 자리에 세우지 않는다", () => {
    const result = buildAutoLineup([slot("st1", "ST"), slot("st2", "ST"), slot("cam", "CAM")], [player("a", ["ST", "CAM"]), player("b", ["ST"])]);
    const ids = Object.values(result).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2);
  });

  it("정확한 포지션을 먼저 맞추고, 그 다음에 유사 포지션으로 빈 자리를 채운다", () => {
    const result = buildAutoLineup([slot("lb", "LB"), slot("lm", "LM")], [player("lmOnly", ["LM"]), player("lbToo", ["LB", "LM"])]);
    expect(result).toEqual({ lb: "lbToo", lm: "lmOnly" });
  });

  it("선수의 선호 순서(배열 앞쪽)를 우선한다", () => {
    const result = buildAutoLineup([slot("st1", "ST"), slot("cam", "CAM")], [player("a", ["ST", "CAM"]), player("b", ["CAM", "ST"])]);
    expect(result).toEqual({ st1: "a", cam: "b" });
  });

  it("사람이 자리보다 적으면 모두 뛰고, 남는 자리만 비운다", () => {
    const result = buildAutoLineup(getSlots("4-4-2"), [player("gk", ["GK"])]);
    expect(result.gk).toBe("gk");
    expect(Object.values(result).filter(Boolean)).toHaveLength(1);
  });

  it("GK가 되는 사람이 없으면 빈 골문으로 두지 않고 남은 사람이 선다", () => {
    expect(buildAutoLineup([slot("gk", "GK")], [player("cb", ["CB"])]).gk).toBe("cb");
  });

  it("맞는 자리가 없는 사람도 사람이 모자라면 아무 자리에나 세운다 (빈자리보다 낫다)", () => {
    const result = buildAutoLineup([slot("lb", "LB"), slot("st1", "ST")], [player("lb", ["LB"]), player("gk", ["GK"])]);
    expect(result).toEqual({ lb: "lb", st1: "gk" });
  });
});

describe("buildAutoLineup: 누가 뛸지 (사람이 자리보다 많을 때)", () => {
  it("덜 뛴 사람이 먼저 뛴다 — 포지션보다 출전 시간이 먼저다", () => {
    const players = [player("striker", ["ST"]), player("cam", ["CAM"])];
    expect(buildAutoLineup([slot("st1", "ST")], players, { appearances: new Map([["striker", 3]]) }).st1).toBe("cam");
  });

  it("출전 시간이 같으면 포지션이 맞는 사람을 고른다", () => {
    const players = [player("cam", ["CAM"]), player("striker", ["ST"])];
    expect(buildAutoLineup([slot("st1", "ST")], players).st1).toBe("striker");
  });

  it("출전 시간이 같으면 뒤에 뛸 기회가 적은 사람(조퇴)이 먼저 뛴다", () => {
    const players = [player("stay", ["ST"]), player("leaving", ["ST"])];
    const remaining = new Map([["stay", 3], ["leaving", 0]]);
    expect(buildAutoLineup([slot("st1", "ST")], players, { remaining }).st1).toBe("leaving");
  });

  it("골키퍼는 GK를 덜 본 사람이 맡고, GK만 하는 사람을 필드로 돌리지 않는다", () => {
    const slots = [slot("gk", "GK"), slot("st1", "ST")];
    const players = [player("keeperA", ["GK"]), player("keeperB", ["GK"]), player("st", ["ST"])];
    const result = buildAutoLineup(slots, players, { keeperDuty: new Map([["keeperA", 1]]) });
    expect(result).toEqual({ gk: "keeperB", st1: "st" });
  });
});

/** 4쿼터를 리듀서처럼 차례로 배치하고 출전 수를 센다 */
function fourQuarters(players: LineupPlayer[]) {
  const slots = getSlots("4-2-3-1");
  const counts = new Map<string, number>();
  const duty = new Map<string, number>();
  const quarters: LineupAssignments[] = [];
  for (let q = 0; q < 4; q++) {
    const remaining = new Map(players.map((p) => [p.id, 3 - q]));
    const result = buildAutoLineup(slots, players, { appearances: counts, keeperDuty: duty, remaining });
    for (const s of slots) {
      const id = result[s.id];
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (s.position === "GK") duty.set(id, (duty.get(id) ?? 0) + 1);
    }
    quarters.push(result);
  }
  return { counts, quarters };
}

describe("4쿼터 공평 배치", () => {
  const field: [string, Position[]][] = [
    ["cb1", ["CB"]], ["cb2", ["CB", "CDM"]], ["lb", ["LB"]], ["rb", ["RB"]], ["cb3", ["CB"]],
    ["cdm", ["CDM", "CM"]], ["cm1", ["CM", "CAM"]], ["cm2", ["CM"]], ["cm3", ["CM", "RB"]], ["cam", ["CAM", "CM"]],
    ["lw", ["LW", "ST"]], ["rw", ["RW", "ST"]], ["st1", ["ST", "CAM"]], ["st2", ["CAM", "ST"]], ["lw2", ["LW", "ST"]],
  ];

  it("골키퍼 1명 + 필드 15명: 필드는 모두 2~3쿼터, 골키퍼는 4쿼터", () => {
    const players = [player("gk", ["GK"]), ...field.map(([id, pos]) => player(id, pos))];
    const { counts } = fourQuarters(players);
    expect(counts.get("gk")).toBe(4);
    for (const [id] of field) expect(counts.get(id)).toBeGreaterThanOrEqual(2);
    for (const [id] of field) expect(counts.get(id)).toBeLessThanOrEqual(3);
  });

  it("골키퍼 2명은 번갈아 막는다", () => {
    const players = [player("gkA", ["GK"]), player("gkB", ["GK"]), ...field.map(([id, pos]) => player(id, pos))];
    const { quarters } = fourQuarters(players);
    expect(quarters.map((q) => q.gk)).toEqual(["gkA", "gkB", "gkA", "gkB"]);
  });

  it("22명이면 모두 정확히 2쿼터씩", () => {
    const extra: [string, Position[]][] = field.slice(0, 5).map(([id, pos]) => [`${id}x`, pos]);
    const players = [player("gkA", ["GK"]), player("gkB", ["GK"]), ...[...field, ...extra].map(([id, pos]) => player(id, pos))];
    const { counts } = fourQuarters(players);
    expect([...new Set(players.map((p) => counts.get(p.id)))]).toEqual([2]);
  });
});

describe("getSlotFit", () => {
  it("가능 포지션이면 primary, 유사 포지션이면 fallback, 아니면 off", () => {
    const st = slot("st1", "ST");
    expect(getSlotFit(st, player("a", ["ST"]))).toBe("primary");
    expect(getSlotFit(st, player("b", ["CAM"]))).toBe("fallback");
    expect(getSlotFit(st, player("c", ["GK"]))).toBe("off");
  });
});
