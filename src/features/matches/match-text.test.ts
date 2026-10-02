import { describe, expect, it } from "vitest";
import { formatMatchText } from "./match-text";
import type { Match } from "./schema";

const upcoming: Match = {
  id: "m1",
  playedAt: "2026-10-04",
  kickoffTime: "07:00",
  opponent: "망원 FC",
  ourScore: null,
  theirScore: null,
  location: "난지 축구장",
  memo: null,
  voteDeadline: null,
  formationId: null,
  formation: null,
  cancelled: false,
  cancelReason: null,
  goals: [],
  createdAt: "",
};

describe("formatMatchText", () => {
  it("예정 경기는 날짜 뒤에 킥오프 시간을 붙이고 참석 투표 링크로 끝난다", () => {
    const text = formatMatchText(upcoming, "뽀잉 fc", "https://example.com/m1");
    expect(text.split("\n")).toEqual([
      "10월 4일 (일) 오전 7시 망원 FC전 예정",
      "장소: 난지 축구장",
      "투표 마감: 10월 4일 (일) 07:00",
      "참석 투표: https://example.com/m1",
    ]);
  });

  it("시간이 없으면 날짜만 쓴다", () => {
    const text = formatMatchText({ ...upcoming, kickoffTime: null, location: null }, "뽀잉 fc");
    // 킥오프가 미정이면 투표는 경기 당일 0시에 마감된다
    expect(text.split("\n")).toEqual(["10월 4일 (일) 망원 FC전 예정", "투표 마감: 10월 4일 (일) 00:00"]);
  });

  it("취소된 경기는 취소 사유와 링크만 쓴다", () => {
    const text = formatMatchText({ ...upcoming, cancelled: true, cancelReason: "우천" }, "뽀잉 fc", "https://example.com/m1");
    expect(text.split("\n")).toEqual(["10월 4일 (일) 망원 FC전 취소 (우천)", "장소: 난지 축구장", "https://example.com/m1"]);
  });

  it("끝난 경기는 점수와 결과, 득점자를 적는다", () => {
    const played: Match = {
      ...upcoming,
      ourScore: 2,
      theirScore: 1,
      goals: [
        { id: "g1", scorerId: "a", scorerName: "장상준", assistId: "b", assistName: "한승우" },
        { id: "g2", scorerId: null, scorerName: null, assistId: null, assistName: null },
      ],
    };
    expect(formatMatchText(played, "뽀잉 fc").split("\n")).toEqual([
      "10월 4일 (일) 망원 FC전 결과",
      "뽀잉 fc 2 : 1 망원 FC (승)",
      "득점: 장상준 (도움 한승우), 미상",
      "장소: 난지 축구장",
    ]);
  });
});
