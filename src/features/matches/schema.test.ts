import { describe, expect, it } from "vitest";
import {
  canJoinLate,
  effectiveVoteDeadline,
  getMatchResult,
  isAwaitingResult,
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
  kickoffTime: null,
  opponent: "상대",
  ourScore: 1,
  theirScore: 0,
  location: null,
  memo: null,
  voteDeadline: null,
  formationId: null,
  formation: null,
  cancelled: false,
  cancelReason: null,
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

describe("참석 투표 마감", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");
  const next = (overrides: Partial<Match>) =>
    match({ playedAt: "2026-10-04", kickoffTime: "07:00", ourScore: null, theirScore: null, ...overrides });

  it("정한 마감 시각이 되는 순간부터 닫힌다", () => {
    expect(isVoteClosed(next({ voteDeadline: "2026-09-26T12:00:01.000Z" }), now)).toBe(false);
    expect(isVoteClosed(next({ voteDeadline: "2026-09-26T12:00:00.000Z" }), now)).toBe(true);
  });

  it("마감을 안 정하면 킥오프 시각에, 킥오프도 미정이면 경기 당일 0시(한국 시간)에 닫힌다", () => {
    expect(effectiveVoteDeadline(next({}))).toBe("2026-10-03T22:00:00.000Z");
    expect(effectiveVoteDeadline(next({ kickoffTime: null }))).toBe("2026-10-03T15:00:00.000Z");
    expect(isVoteClosed(next({}), new Date("2026-10-04T06:59:00+09:00"))).toBe(false);
    expect(isVoteClosed(next({}), new Date("2026-10-04T07:00:00+09:00"))).toBe(true);
  });

  it("결과가 나왔거나 취소된 경기는 마감 전이어도 닫혀 있다", () => {
    expect(isVoteClosed(next({ ourScore: 1, theirScore: 0 }), now)).toBe(true);
    expect(isVoteClosed(next({ cancelled: true }), now)).toBe(true);
  });

  it("'늦게라도 참석'은 마감 뒤부터 킥오프 2시간 뒤까지만", () => {
    const m = next({ voteDeadline: "2026-10-03T12:00:00.000Z" }); // 전날 21:00
    expect(canJoinLate(m, new Date("2026-10-03T20:00:00+09:00"))).toBe(false); // 아직 마감 전
    expect(canJoinLate(m, new Date("2026-10-03T21:30:00+09:00"))).toBe(true);
    expect(canJoinLate(m, new Date("2026-10-04T08:59:00+09:00"))).toBe(true);
    expect(canJoinLate(m, new Date("2026-10-04T09:00:00+09:00"))).toBe(false); // 결과 입력 대기
    expect(canJoinLate({ ...m, cancelled: true }, new Date("2026-10-03T21:30:00+09:00"))).toBe(false);
  });
});

describe("isAwaitingResult", () => {
  const at = (iso: string) => new Date(iso);
  const morning = match({ playedAt: "2026-10-04", kickoffTime: "07:00", ourScore: null, theirScore: null });

  it("킥오프 2시간 뒤(한국 시간)부터 결과 입력 대기", () => {
    expect(isAwaitingResult(morning, at("2026-10-04T08:59:59+09:00"))).toBe(false);
    expect(isAwaitingResult(morning, at("2026-10-04T09:00:00+09:00"))).toBe(true);
  });

  it("킥오프 시간이 없으면 경기 다음 날 0시부터", () => {
    const noTime = { ...morning, kickoffTime: null };
    expect(isAwaitingResult(noTime, at("2026-10-04T23:59:59+09:00"))).toBe(false);
    expect(isAwaitingResult(noTime, at("2026-10-05T00:00:00+09:00"))).toBe(true);
  });

  it("결과가 기록된 경기는 대기가 아니다", () => {
    expect(isAwaitingResult({ ...morning, ourScore: 1, theirScore: 0 }, at("2026-10-10T00:00:00+09:00"))).toBe(false);
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
    const cancelled = match({ playedAt: "2026-09-13", ourScore: null, theirScore: null, cancelled: true });
    const { upcoming: up, finished } = splitMatches([later, a, sooner, b, cancelled]);
    expect(up.map((m) => m.playedAt)).toEqual(["2026-10-04", "2026-10-11"]);
    expect(finished).toEqual([a, b, cancelled]); // 취소된 경기는 지난 경기 쪽
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
    kickoffTime: null,
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

  it("킥오프는 정각만 받는다", () => {
    const halfPast = matchInputSchema.safeParse({ ...base, kickoffTime: "07:30" });
    expect(halfPast.success).toBe(false);
    if (!halfPast.success) expect(halfPast.error.issues[0].message).toBe("킥오프는 정각 단위로 골라 주세요");
  });

  it("킥오프 시간은 HH:00만 받고 빈 값은 null이 된다", () => {
    const ok = matchInputSchema.safeParse({ ...base, kickoffTime: "07:00" });
    expect(ok.success && ok.data.kickoffTime).toBe("07:00");
    const empty = matchInputSchema.safeParse({ ...base, kickoffTime: "" });
    expect(empty.success && empty.data.kickoffTime).toBeNull();
    const bad = matchInputSchema.safeParse({ ...base, kickoffTime: "7시" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].path).toEqual(["kickoffTime"]);
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

  it("득점 기록이 점수보다 많으면 거절하고, 적은 건 허용한다 (득점자 모르는 골)", () => {
    const two = [{ scorerId: "a", assistId: null }, { scorerId: "b", assistId: null }];
    const over = matchInputSchema.safeParse({ ...base, ourScore: 1, goals: two });
    expect(over.success).toBe(false);
    if (!over.success) expect(over.error.issues[0].path).toEqual(["goals"]);
    expect(matchInputSchema.safeParse({ ...base, ourScore: 3, goals: two }).success).toBe(true);
  });

  it("직접 정한 투표 마감은 킥오프 전이어야 한다", () => {
    const upcomingBase = { ...base, ourScore: null, theirScore: null, playedAt: "2026-10-04", kickoffTime: "07:00" };
    expect(matchInputSchema.safeParse({ ...upcomingBase, voteDeadline: "2026-10-03T22:00:00.000Z" }).success).toBe(true);
    const late = matchInputSchema.safeParse({ ...upcomingBase, voteDeadline: "2026-10-03T22:30:00.000Z" });
    expect(late.success).toBe(false);
    if (!late.success) expect(late.error.issues[0].path).toEqual(["voteDeadline"]);
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
