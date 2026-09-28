import { describe, expect, it } from "vitest";
import { hashPin, LOCK_MINUTES, MAX_FAILURES, nextFailureState, verifyPin } from "./pin";

describe("hashPin / verifyPin", () => {
  it("같은 PIN만 통과하고, 해시에는 PIN이 그대로 들어가지 않는다", async () => {
    const stored = await hashPin("0427");
    expect(stored).not.toContain("0427");
    expect(await verifyPin("0427", stored)).toBe(true);
    expect(await verifyPin("0428", stored)).toBe(false);
  });

  it("같은 PIN이라도 해시는 매번 다르다 (salt)", async () => {
    expect(await hashPin("1234")).not.toBe(await hashPin("1234"));
  });

  it("형식이 깨진 저장값은 통과시키지 않는다", async () => {
    expect(await verifyPin("1234", "garbage")).toBe(false);
  });
});

describe("nextFailureState", () => {
  const now = new Date("2026-09-28T00:00:00.000Z");

  it(`${MAX_FAILURES}번째 실패에서 ${LOCK_MINUTES}분 잠그고 횟수를 0으로 돌린다`, () => {
    expect(nextFailureState(0, now)).toEqual({ pinFailedCount: 1, pinLockedUntil: null });
    expect(nextFailureState(MAX_FAILURES - 2, now)).toEqual({ pinFailedCount: MAX_FAILURES - 1, pinLockedUntil: null });
    expect(nextFailureState(MAX_FAILURES - 1, now)).toEqual({
      pinFailedCount: 0,
      pinLockedUntil: "2026-09-28T00:10:00.000Z",
    });
  });
});
