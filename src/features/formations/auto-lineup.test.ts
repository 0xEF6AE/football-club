import { describe, expect, it } from "vitest";
import type { Position } from "@/lib/positions";
import { buildAutoLineup, getSlotFit, type LineupPlayer } from "./auto-lineup";
import type { FormationSlot } from "./schema";
import { getSlots } from "./templates";

const player = (id: string, positions: Position[]): LineupPlayer => ({ id, positions });
const slot = (id: string, position: Position): FormationSlot => ({ id, position, x: 0, y: 0, row: 0 });

describe("buildAutoLineup", () => {
  it("정확히 맞는 선수가 있으면 모든 자리를 채운다", () => {
    const slots = getSlots("4-2-3-1");
    const players = slots.map((s, i) => player(`p${i}`, [s.position]));
    const result = buildAutoLineup(slots, players);

    expect(Object.keys(result)).toHaveLength(slots.length);
    for (const s of slots) {
      const assigned = players.find((p) => p.id === result[s.id]);
      expect(assigned?.positions).toContain(s.position);
    }
  });

  it("같은 선수를 두 자리에 세우지 않는다", () => {
    const slots = [slot("st1", "ST"), slot("st2", "ST"), slot("cam", "CAM")];
    const players = [player("a", ["ST", "CAM"]), player("b", ["ST"])];
    const result = buildAutoLineup(slots, players);

    const ids = Object.values(result).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2);
  });

  it("정확한 포지션을 먼저 맞추고, 그 다음에 유사 포지션으로 빈 자리를 채운다", () => {
    const slots = [slot("lb", "LB"), slot("lm", "LM")];
    // 둘 다 LM이 가능하지만 한 명만 LB가 가능하다 → LB 자리는 LB 가능 선수에게.
    const players = [player("lmOnly", ["LM"]), player("lbToo", ["LB", "LM"])];
    const result = buildAutoLineup(slots, players);

    expect(result.lb).toBe("lbToo");
    expect(result.lm).toBe("lmOnly");
  });

  it("아무도 맞지 않는 자리는 비워 둔다", () => {
    const slots = getSlots("4-4-2");
    const result = buildAutoLineup(slots, [player("gk", ["GK"])]);

    expect(result.gk).toBe("gk");
    expect(Object.values(result).filter(Boolean)).toHaveLength(1);
  });

  it("선수의 선호 순서(배열 앞쪽)를 우선한다", () => {
    const slots = [slot("st1", "ST"), slot("cam", "CAM")];
    const players = [player("a", ["ST", "CAM"]), player("b", ["CAM", "ST"])];
    const result = buildAutoLineup(slots, players);

    expect(result.st1).toBe("a");
    expect(result.cam).toBe("b");
  });

  it("골키퍼는 유사 포지션으로 대체하지 않는다", () => {
    const result = buildAutoLineup([slot("gk", "GK")], [player("cb", ["CB"])]);
    expect(result.gk).toBeNull();
  });

  it("출전 수를 주면 같은 등급 안에서는 적게 뛴 선수를 먼저 세운다", () => {
    const slots = [slot("gk", "GK")];
    const players = [player("a", ["GK"]), player("b", ["GK"])];
    expect(buildAutoLineup(slots, players).gk).toBe("a");
    expect(buildAutoLineup(slots, players, { appearances: new Map([["a", 1]]) }).gk).toBe("b");
  });

  it("적게 뛰었어도 유사 포지션 선수가 정확한 포지션 선수를 밀어내지는 않는다", () => {
    const slots = [slot("st1", "ST")];
    const players = [player("striker", ["ST"]), player("cam", ["CAM"])];
    const result = buildAutoLineup(slots, players, { appearances: new Map([["striker", 3]]) });
    expect(result.st1).toBe("striker");
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
