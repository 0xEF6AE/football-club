import { describe, expect, it } from "vitest";
import { formatKickoffTime } from "./utils";

describe("formatKickoffTime", () => {
  it("정각은 '오전 7시', 분이 있으면 '오후 3시 30분'", () => {
    expect(formatKickoffTime("07:00")).toBe("오전 7시");
    expect(formatKickoffTime("15:30")).toBe("오후 3시 30분");
  });

  it("12시 경계: 정오는 오후 12시, 자정은 오전 12시", () => {
    expect(formatKickoffTime("12:00")).toBe("오후 12시");
    expect(formatKickoffTime("00:00")).toBe("오전 12시");
  });

  it("형식이 이상하면 그대로 돌려준다", () => {
    expect(formatKickoffTime("7시")).toBe("7시");
    expect(formatKickoffTime("25:00")).toBe("25:00");
  });
});
