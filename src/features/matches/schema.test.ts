import { describe, expect, it } from "vitest";
import {
  getMatchResult,
  isPlayed,
  isVoteClosed,
  matchInputSchema,
  splitMatches,
  summarizeRecord,
  summarizeScorers,
  type Match,
} from "./schema";

const match = (overrides: Partial<Match>): Match => ({
  id: crypto.randomUUID(),
  playedAt: "2026-09-27",
  opponent: "상대",
  ourScore: 1,
  theirScore: 0,
  location: null,
  memo: null,
  voteDeadline: null,
  formationId: null,
  formation: null,
  goals: [],
  createdAt: "",
  ...overrides,
});

const upcoming = (playedAt: string) => match({ playedAt, ourScore: null, theirScore: null });

describe("isPlayed / getMatchResult", () => {
  it("점수가 둘 다 있어야 결과가 기록된 경기다", () => {
    expect(isPlayed(match({}))).toBe(true);
    expect(isPlayed(upcoming("2026-10-04"))).toBe(false);
  });

  it("승/무/패를 판정한다", () => {
    expect(getMatchResult({ ourScore: 2, theirScore: 1 })).toBe("win");
    expect(getMatchResult({ ourScore: 1, theirScore: 1 })).toBe("draw");
    expect(getMatchResult({ ourScore: 0, theirScore: 3 })).toBe("loss");
  });
});

describe("isVoteClosed", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");

  it("마감 시각이 없으면 계속 열려 있다", () => {
    expect(isVoteClosed({ voteDeadline: null }, now)).toBe(false);
  });

  it("마감 시각이 되는 순간부터 닫힌다", () => {
    expect(isVoteClosed({ voteDeadline: "2026-09-26T12:00:01.000Z" }, now)).toBe(false);
    expect(isVoteClosed({ voteDeadline: "2026-09-26T12:00:00.000Z" }, now)).toBe(true);
    expect(isVoteClosed({ voteDeadline: "2026-09-25T21:00:00.000Z" }, now)).toBe(true);
  });
});

describe("summarizeRecord", () => {
  it("예정 경기는 전적에 넣지 않는다", () => {
    const record = summarizeRecord([
      match({ ourScore: 3, theirScore: 1 }),
      match({ ourScore: 0, theirScore: 0 }),
      match({ ourScore: 1, theirScore: 2 }),
      upcoming("2026-10-04"),
    ]);
    expect(record).toEqual({ played: 3, win: 1, draw: 1, loss: 1, goalsFor: 4, goalsAgainst: 3 });
  });
});

describe("splitMatches", () => {
  it("예정 경기는 가까운 날짜부터, 지난 경기는 입력 순서를 유지한다", () => {
    const a = match({ playedAt: "2026-09-27" });
    const b = match({ playedAt: "2026-09-20" });
    const later = upcoming("2026-10-11");
    const sooner = upcoming("2026-10-04");
    const { upcoming: up, played } = splitMatches([later, a, sooner, b]);
    expect(up.map((m) => m.playedAt)).toEqual(["2026-10-04", "2026-10-11"]);
    expect(played).toEqual([a, b]);
  });
});

describe("summarizeScorers", () => {
  it("득점자별로 묶고 미상은 기타로 센다", () => {
    const goal = (scorerName: string | null) => ({ id: "", scorerId: null, assistId: null, scorerName, assistName: null });
    expect(summarizeScorers([goal("장상준"), goal("이무성"), goal("장상준"), goal(null)])).toBe("장상준 2, 이무성, 기타 1");
  });
});

describe("matchInputSchema", () => {
  const base = {
    playedAt: "2026-09-27",
    opponent: "FC 한강",
    ourScore: 2,
    theirScore: 1,
    location: "",
    memo: null,
    voteDeadline: null,
    formationId: null,
    goals: [],
  };

  it("투표 마감은 ISO(UTC) 형식만 받는다", () => {
    const upcomingBase = { ...base, ourScore: null, theirScore: null };
    expect(matchInputSchema.safeParse({ ...upcomingBase, voteDeadline: "2026-09-26T12:00:00.000Z" }).success).toBe(true);
    const local = matchInputSchema.safeParse({ ...upcomingBase, voteDeadline: "2026-09-26T21:00" });
    expect(local.success).toBe(false);
    if (!local.success) expect(local.error.issues[0].path).toEqual(["voteDeadline"]);
  });

  it("정상 입력은 통과하고 빈 문자열 장소는 null이 된다", () => {
    const result = matchInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.location).toBeNull();
  });

  it("점수는 둘 다 있거나 둘 다 없어야 한다", () => {
    const result = matchInputSchema.safeParse({ ...base, theirScore: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["theirScore"]);
  });

  it("예정 경기에는 득점 기록을 붙일 수 없다", () => {
    const result = matchInputSchema.safeParse({
      ...base,
      ourScore: null,
      theirScore: null,
      goals: [{ scorerId: null, assistId: null }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["goals"]);
  });

  it("점수가 비어 있으면 입력 안내 메시지를 낸다", () => {
    const result = matchInputSchema.safeParse({ ...base, ourScore: undefined });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("점수를 입력해 주세요");
  });
});
