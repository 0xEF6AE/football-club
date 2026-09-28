import { describe, expect, it } from "vitest";
import type { Match, MatchGoal } from "./schema";
import { buildHeadToHead, buildLeaderboard, filterSeason, formatRecord, listSeasons, normalizeOpponent } from "./stats";

const goal = (scorer: [string, string] | null, assist: [string, string] | null = null): MatchGoal => ({
  id: crypto.randomUUID(),
  scorerId: scorer?.[0] ?? null,
  scorerName: scorer?.[1] ?? null,
  assistId: assist?.[0] ?? null,
  assistName: assist?.[1] ?? null,
});

const match = (playedAt: string, goals: MatchGoal[], played = true): Match => ({
  id: crypto.randomUUID(),
  playedAt,
  opponent: "상대",
  ourScore: played ? goals.length : null,
  theirScore: played ? 0 : null,
  location: null,
  memo: null,
  voteDeadline: null,
  formationId: null,
  formation: null,
  goals,
  createdAt: "",
});

/** 상대전적 테스트용: 상대 이름과 점수만 다르게 */
const versus = (opponent: string, ourScore: number | null, theirScore: number | null): Match => ({
  ...match("2026-09-27", [], ourScore !== null),
  opponent,
  ourScore,
  theirScore,
});

const A: [string, string] = ["a", "가"];
const B: [string, string] = ["b", "나"];
const C: [string, string] = ["c", "다"];

describe("buildLeaderboard", () => {
  it("골 → 도움 → 이름 순으로 정렬하고 포인트를 합산한다", () => {
    const board = buildLeaderboard([
      match("2026-09-20", [goal(A, B), goal(A), goal(B, C)]),
      match("2026-09-27", [goal(C, B)]),
    ]);

    expect(board.map((s) => [s.name, s.goals, s.assists, s.points])).toEqual([
      ["가", 2, 0, 2],
      ["나", 1, 2, 3],
      ["다", 1, 1, 2],
    ]);
  });

  it("지워진 선수(이름 없음)의 기록과 예정 경기는 제외한다", () => {
    const board = buildLeaderboard([
      match("2026-09-20", [goal(null), goal(A)]),
      match("2026-10-04", [goal(B)], false),
    ]);
    expect(board.map((s) => s.name)).toEqual(["가"]);
  });
});

describe("listSeasons / filterSeason", () => {
  const matches = [match("2025-11-01", []), match("2026-03-01", []), match("2026-09-27", [])];

  it("연도를 최신순으로 뽑는다", () => {
    expect(listSeasons(matches)).toEqual(["2026", "2025"]);
  });

  it("연도로 거르고 null이면 전체", () => {
    expect(filterSeason(matches, "2026")).toHaveLength(2);
    expect(filterSeason(matches, null)).toHaveLength(3);
  });
});

describe("buildHeadToHead", () => {
  const matches = [
    versus("망원 FC", 2, 1),
    versus("망원FC", 0, 0),
    versus("망원 fc", 1, 3),
    versus("망원 유나이티드", 5, 0),
    versus("망원 FC", null, null), // 예정 경기
  ];

  it("공백과 대소문자가 달라도 같은 상대로 묶고, 예정 경기는 빼고, 철자가 다르면 다른 팀이다", () => {
    const record = buildHeadToHead(matches, "망원 FC");
    expect(record).toMatchObject({ played: 3, win: 1, draw: 1, loss: 1, goalsFor: 3, goalsAgainst: 4 });
    expect(record.matches.map((m) => m.opponent)).toEqual(["망원 FC", "망원FC", "망원 fc"]);
  });

  it("한 번도 안 만난 상대는 0전", () => {
    expect(buildHeadToHead(matches, "성수 유나이티드").played).toBe(0);
  });

  it("normalizeOpponent는 공백 제거 + 소문자", () => {
    expect(normalizeOpponent("  망원  FC ")).toBe("망원fc");
  });
});

describe("formatRecord", () => {
  it("0인 항목은 빼고 '3전 2승 1패'처럼 적는다", () => {
    expect(formatRecord({ played: 3, win: 2, draw: 0, loss: 1, goalsFor: 0, goalsAgainst: 0 })).toBe("3전 2승 1패");
    expect(formatRecord({ played: 1, win: 0, draw: 1, loss: 0, goalsFor: 0, goalsAgainst: 0 })).toBe("1전 1무");
    expect(formatRecord({ played: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0 })).toBe("0전");
  });
});
