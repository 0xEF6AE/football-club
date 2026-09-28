import { describe, expect, it } from "vitest";
import type { Attendance } from "@/features/attendance/schema";
import type { Match, MatchGoal } from "@/features/matches/schema";
import type { Player } from "./schema";
import { buildPlayerStats } from "./stats";

const me: Player = { id: "me", name: "이무성", positions: ["CB", "LB"], hasPin: false, createdAt: "" };

const goal = (scorerId: string | null, assistId: string | null = null): MatchGoal => ({
  id: crypto.randomUUID(),
  scorerId,
  scorerName: scorerId,
  assistId,
  assistName: assistId,
});

const match = (id: string, ourScore: number | null, theirScore: number | null, goals: MatchGoal[] = []): Match => ({
  id,
  playedAt: "2026-09-27",
  kickoffTime: null,
  opponent: "상대",
  ourScore,
  theirScore,
  location: null,
  memo: null,
  voteDeadline: null,
  formationId: null,
  formation: null,
  goals,
  createdAt: "",
});

const vote = (matchId: string, status: Attendance["status"]): Attendance => ({
  id: crypto.randomUUID(),
  matchId,
  playerId: me.id,
  status,
  updatedAt: "",
});

describe("buildPlayerStats", () => {
  const matches = [
    match("m4", null, null), // 예정 경기: 기록에서 제외
    match("m3", 0, 2), // 흔적 없음 → 결장
    match("m2", 1, 1, [goal("other", "me")]), // 도움 → 출전
    match("m1", 3, 1, [goal("me"), goal("me", "other"), goal("other")]), // 참석 투표 + 골 2
  ];
  const attendance = [vote("m1", "yes"), vote("m3", "no"), vote("m4", "maybe")];
  const stats = buildPlayerStats(me, matches, attendance, new Set(["m3-not-linked"]));

  it("출전은 참석 투표·포메이션·득점 기록 중 하나라도 있으면 세고, 예정 경기는 빼고 센다", () => {
    expect(stats.teamPlayed).toBe(3);
    expect(stats.appearances).toBe(2);
    expect(stats.matches.map((l) => [l.matchId, l.appeared, l.sources])).toEqual([
      ["m3", false, []],
      ["m2", true, ["goal"]],
      ["m1", true, ["attendance", "goal"]],
    ]);
  });

  it("골·도움·참석률·출전 시 전적을 계산한다", () => {
    expect(stats.goals).toBe(2);
    expect(stats.assists).toBe(1);
    expect(stats.attendanceRate).toBeCloseTo(2 / 3);
    expect(stats.record).toEqual({ played: 2, win: 1, draw: 1, loss: 0, goalsFor: 4, goalsAgainst: 2 });
  });

  it("투표 응답은 예정 경기 것까지 상태별로 센다", () => {
    expect(stats.votes).toEqual({ yes: 1, no: 1, maybe: 1 });
  });

  it("포메이션 명단에만 있는 경기도 출전이다", () => {
    const withLineup = buildPlayerStats(me, matches, [], new Set(["m3"]));
    expect(withLineup.matches.find((l) => l.matchId === "m3")).toMatchObject({ appeared: true, sources: ["lineup"] });
  });

  it("팀 경기가 없으면 참석률은 null", () => {
    expect(buildPlayerStats(me, [match("m4", null, null)], [], new Set()).attendanceRate).toBeNull();
  });
});
