import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * 쓰기 보호. .env의 ADMIN_PASSCODE가 설정돼 있으면 등록·수정·삭제는 관리자 쿠키가 있어야 한다.
 * 설정돼 있지 않으면(로컬 개발) 모두 허용된다.
 * 피드백 작성과 참석 응답은 이 보호를 받지 않는다 (모임원 누구나).
 */
export const ADMIN_COOKIE = "fc_admin";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function passcode(): string | null {
  const value = process.env.ADMIN_PASSCODE?.trim();
  return value ? value : null;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** 쿠키에 넣는 값. 비밀번호 자체가 아니라 비밀번호에서 파생된 해시. */
function sessionToken(secret: string): string {
  return sha256(`football-club-admin:${secret}`).toString("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isProtected(): boolean {
  return passcode() !== null;
}

export function verifyPasscode(input: string): boolean {
  const secret = passcode();
  if (!secret) return true;
  return timingSafeEqual(sha256(input), sha256(secret));
}

export function isAdminRequest(request: NextRequest): boolean {
  const secret = passcode();
  if (!secret) return true;
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  return cookie !== undefined && safeEqual(cookie, sessionToken(secret));
}

export function adminCookie() {
  const secret = passcode();
  return {
    name: ADMIN_COOKIE,
    value: secret ? sessionToken(secret) : "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  };
}

/** 비밀번호 무차별 대입을 늦추는 프로세스 단위 제한. 분당 시도 횟수를 넘으면 잠시 막는다. */
const attempts: number[] = [];
const ATTEMPT_WINDOW_MS = 60 * 1000;
const ATTEMPT_LIMIT = 20;

export function registerLoginAttempt(now = Date.now()): boolean {
  while (attempts.length > 0 && now - attempts[0] > ATTEMPT_WINDOW_MS) attempts.shift();
  if (attempts.length >= ATTEMPT_LIMIT) return false;
  attempts.push(now);
  return true;
}
