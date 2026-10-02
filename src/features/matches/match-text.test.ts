import { describe, expect, it } from "vitest";
import { formatDeadlineLead, formatMatchText, formatSecondCallText, formatVoteDeadline } from "./match-text";
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
  lateJoinDeadline: null,
  formationId: null,
  formation: null,
  cancelled: false,
  cancelReason: null,
  goals: [],
  createdAt: "",
};

describe("formatMatchText", () => {
  it("예정 경기는 킥오프와 투표 마감을 각각 이름 붙여 같은 표기로 적고 참석 투표 링크로 끝난다", () => {
    const match = { ...upcoming, voteDeadline: "2026-10-03T12:00:00.000Z" };
    const text = formatMatchText(match, "뽀잉 fc", "https://example.com/m1");
    expect(text.split("\n")).toEqual([
      "10월 4일 (일) 망원 FC전 예정",
      "킥오프: 10월 4일 (일) 오전 7시",
      "장소: 난지 축구장",
      "투표 마감: 10월 3일 (토) 오후 9시",
      "참석 투표: https://example.com/m1",
    ]);
  });

  it("마감을 따로 안 정했으면 '킥오프 때' 마감이라고 쓴다", () => {
    const text = formatMatchText({ ...upcoming, location: null }, "뽀잉 fc");
    expect(text.split("\n")).toEqual([
      "10월 4일 (일) 망원 FC전 예정",
      "킥오프: 10월 4일 (일) 오전 7시",
      "투표 마감: 킥오프 때(오전 7시)",
    ]);
  });

  it("킥오프가 미정이면 킥오프 줄을 빼고, 투표는 경기 당일 0시에 마감된다", () => {
    const text = formatMatchText({ ...upcoming, kickoffTime: null, location: null }, "뽀잉 fc");
    expect(text.split("\n")).toEqual(["10월 4일 (일) 망원 FC전 예정", "투표 마감: 10월 4일 (일) 오전 0시"]);
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

describe("formatVoteDeadline / formatDeadlineLead", () => {
  it("따로 정한 마감은 날짜와 시각, 안 정했으면 킥오프 때, 킥오프도 미정이면 경기 당일 0시", () => {
    expect(formatVoteDeadline({ ...upcoming, voteDeadline: "2026-10-03T12:00:00.000Z" })).toBe("10월 3일 (토) 오후 9시");
    expect(formatVoteDeadline(upcoming)).toBe("킥오프 때(오전 7시)");
    expect(formatVoteDeadline({ ...upcoming, kickoffTime: null })).toBe("10월 4일 (일) 오전 0시");
  });

  it("마감이 킥오프보다 얼마나 앞인지 큰 단위 두 개까지 적는다", () => {
    // 킥오프 10월 4일 07:00 KST = 3일 22:00Z
    expect(formatDeadlineLead({ ...upcoming, voteDeadline: "2026-10-03T12:00:00.000Z" })).toBe("킥오프 10시간 전");
    expect(formatDeadlineLead({ ...upcoming, voteDeadline: "2026-10-02T11:30:00.000Z" })).toBe("킥오프 1일 10시간 전");
    expect(formatDeadlineLead({ ...upcoming, voteDeadline: "2026-10-03T21:30:00.000Z" })).toBe("킥오프 30분 전");
  });

  it("마감을 안 정했거나 킥오프가 미정이면 말할 게 없다", () => {
    expect(formatDeadlineLead(upcoming)).toBeNull();
    expect(formatDeadlineLead({ ...upcoming, kickoffTime: null, voteDeadline: "2026-10-03T12:00:00.000Z" })).toBeNull();
  });
});

describe("formatSecondCallText", () => {
  it("보류·불참·미투표 명단과 추가 모집 마감, 지금 참석 수를 적는다 (빈 그룹은 뺀다)", () => {
    const match = { ...upcoming, voteDeadline: "2026-10-03T12:00:00.000Z", lateJoinDeadline: "2026-10-03T13:00:00.000Z" };
    const text = formatSecondCallText(match, { maybe: ["김민수"], no: [], none: ["강태양", "신재원"], attending: 15, guests: 2 }, "https://x/m1");
    expect(text.split("\n")).toEqual([
      "[10월 4일 (일) 망원 FC전 추가 참석 확인]",
      "킥오프: 10월 4일 (일) 오전 7시",
      "투표는 마감됐어요. 아래 분들 중 올 수 있는 분은 링크에서 '늦게라도 참석'을 눌러 주세요.",
      "추가 참석 마감: 10월 3일 (토) 오후 10시",
      "보류: 김민수",
      "미투표: 강태양, 신재원",
      "지금 참석 15명 + 용병 2명",
      "https://x/m1",
    ]);
  });
});
