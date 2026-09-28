import { describe, expect, it } from "vitest";
import type { Player } from "@/features/players/schema";
import { formatLineupText, formatQuartersText } from "./lineup-text";

const player = (id: string, name: string): Player => ({ id, name, positions: ["CM"], createdAt: "" });

describe("formatLineupText", () => {
  it("공격 줄부터 골키퍼 순서로, 한 줄 안에서는 왼쪽부터 적는다", () => {
    const playersById = new Map([
      ["a", player("a", "가")],
      ["b", player("b", "나")],
      ["c", player("c", "다")],
    ]);
    const text = formatLineupText({
      shape: "4-4-2",
      assignments: { gk: "a", lm: "b", st2: "c" },
      bench: [player("d", "라")],
      playersById,
    });

    expect(text.split("\n")).toEqual([
      "4-4-2",
      "ST (빈자리) / ST 다",
      "LM 나 / CM (빈자리) / CM (빈자리) / RM (빈자리)",
      "LB (빈자리) / CB (빈자리) / CB (빈자리) / RB (빈자리)",
      "GK 가",
      "벤치: 라",
    ]);
  });

  it("제목이 있으면 첫 줄에 모양과 함께 적고, 벤치가 없으면 줄을 만들지 않는다", () => {
    const text = formatLineupText({
      title: "주말 라인업",
      shape: "4-2-3-1",
      assignments: {},
      bench: [],
      playersById: new Map(),
    });
    expect(text.startsWith("주말 라인업 (4-2-3-1)\n")).toBe(true);
    expect(text).not.toContain("벤치");
  });
});

describe("formatQuartersText", () => {
  it("쿼터마다 한 덩어리씩 적고, 벤치는 그 쿼터에 자리가 없는 참석 선수다", () => {
    const playersById = new Map([
      ["a", player("a", "가")],
      ["b", player("b", "나")],
    ]);
    const text = formatQuartersText({
      title: "주말",
      quarters: [
        { shape: "4-4-2", assignments: { gk: "a" } },
        { shape: "4-3-3", assignments: { gk: "b" } },
        { shape: "4-4-2", assignments: {} },
        { shape: "4-4-2", assignments: {} },
      ],
      attendingIds: ["a", "b"],
      playersById,
    });

    const blocks = text.split("\n\n");
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toBe("주말");
    expect(blocks[1].startsWith("1쿼터 (4-4-2)\n")).toBe(true);
    expect(blocks[1]).toContain("GK 가");
    expect(blocks[1]).toContain("벤치: 나");
    expect(blocks[2].startsWith("2쿼터 (4-3-3)\n")).toBe(true);
    expect(blocks[2]).toContain("벤치: 가");
    expect(blocks[3]).toContain("벤치: 가, 나");
  });

  it("제목이 없으면 1쿼터부터 시작한다", () => {
    const text = formatQuartersText({
      quarters: Array.from({ length: 4 }, () => ({ shape: "4-2-3-1" as const, assignments: {} })),
      attendingIds: [],
      playersById: new Map(),
    });
    expect(text.startsWith("1쿼터 (4-2-3-1)\n")).toBe(true);
  });
});
