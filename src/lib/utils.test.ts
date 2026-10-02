import { describe, expect, it } from "vitest";
import { formatDateTime, formatKickoffTime } from "./utils";

describe("formatKickoffTime", () => {
  it("정각은 '오전 7시', 분이 있으면 '오후 3시 30분'", () => {
    expect(formatKickoffTime("07:00")).toBe("오전 7시");
    expect(formatKickoffTime("15:30")).toBe("오후 3시 30분");
  });

  it("12시 경계: 정오는 오후 12시, 자정은 오전 0시 (오전 12시는 낮으로 읽기 쉽다)", () => {
    expect(formatKickoffTime("12:00")).toBe("오후 12시");
    expect(formatKickoffTime("00:00")).toBe("오전 0시");
  });

  it("형식이 이상하면 그대로 돌려준다", () => {
    expect(formatKickoffTime("7시")).toBe("7시");
    expect(formatKickoffTime("25:00")).toBe("25:00");
  });
});

describe("formatDateTime", () => {
  it("킥오프와 같은 '오전/오후 N시' 표기에 날짜를 붙이고, 한국 시간으로 보여 준다", () => {
    expect(formatDateTime("2026-10-03T12:00:00.000Z")).toBe("10월 3일 (토) 오후 9시");
    expect(formatDateTime("2026-10-03T12:30:00.000Z")).toBe("10월 3일 (토) 오후 9시 30분");
    expect(formatDateTime("2026-10-03T15:00:00.000Z")).toBe("10월 4일 (일) 오전 0시");
  });
});
