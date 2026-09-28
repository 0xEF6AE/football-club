import { describe, expect, it } from "vitest";
import { feedbackLastDay, isFeedbackOpen } from "./schema";

describe("feedbackLastDay", () => {
  it("경기 날짜에 14일을 더한다 (달·해 넘김 포함)", () => {
    expect(feedbackLastDay("2026-09-27")).toBe("2026-10-11");
    expect(feedbackLastDay("2026-12-25")).toBe("2027-01-08");
  });
});

describe("isFeedbackOpen", () => {
  const played = { playedAt: "2026-09-27", ourScore: 2, theirScore: 1 };

  it("마지막 날 한국 시간 자정 직전까지 열려 있고, 자정이 지나면 닫힌다", () => {
    expect(isFeedbackOpen(played, new Date("2026-10-11T23:59:59.000+09:00"))).toBe(true);
    expect(isFeedbackOpen(played, new Date("2026-10-12T00:00:00.000+09:00"))).toBe(false);
  });

  it("결과가 없는 예정 경기는 닫혀 있다", () => {
    expect(isFeedbackOpen({ ...played, ourScore: null, theirScore: null }, new Date("2026-09-28T12:00:00Z"))).toBe(false);
  });
});
