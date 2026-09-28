import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, adminCookie, isAdminRequest, isProtected, registerLoginAttempt, verifyPasscode } from "./admin";

const request = (cookie?: string) =>
  new NextRequest("http://localhost/api/players", { headers: cookie ? { cookie } : {} });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("비밀번호가 없을 때(로컬 개발)", () => {
  it("보호되지 않고 누구나 관리자다", () => {
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect(isProtected()).toBe(false);
    expect(isAdminRequest(request())).toBe(true);
  });
});

describe("비밀번호가 있을 때", () => {
  it("맞는 비밀번호만 통과한다", () => {
    vi.stubEnv("ADMIN_PASSCODE", "secret-1234");
    expect(isProtected()).toBe(true);
    expect(verifyPasscode("secret-1234")).toBe(true);
    expect(verifyPasscode("secret-12345")).toBe(false);
    expect(verifyPasscode("")).toBe(false);
  });

  it("발급한 쿠키가 있어야 관리자이고, 쿠키에는 비밀번호가 그대로 들어가지 않는다", () => {
    vi.stubEnv("ADMIN_PASSCODE", "secret-1234");
    const cookie = adminCookie();

    expect(cookie.value).not.toContain("secret-1234");
    expect(isAdminRequest(request())).toBe(false);
    expect(isAdminRequest(request(`${ADMIN_COOKIE}=${cookie.value}`))).toBe(true);
    expect(isAdminRequest(request(`${ADMIN_COOKIE}=wrong`))).toBe(false);
  });

  it("비밀번호를 바꾸면 이전 쿠키는 무효가 된다", () => {
    vi.stubEnv("ADMIN_PASSCODE", "old");
    const old = adminCookie().value;
    vi.stubEnv("ADMIN_PASSCODE", "new");
    expect(isAdminRequest(request(`${ADMIN_COOKIE}=${old}`))).toBe(false);
  });
});

describe("registerLoginAttempt", () => {
  it("1분 안에 20번을 넘기면 막고, 시간이 지나면 다시 허용한다", () => {
    const start = 1_000_000;
    for (let i = 0; i < 20; i += 1) expect(registerLoginAttempt(start + i)).toBe(true);
    expect(registerLoginAttempt(start + 30)).toBe(false);
    expect(registerLoginAttempt(start + 61_000)).toBe(true);
  });
});
