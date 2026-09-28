import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { MatchInput } from "@/features/matches/schema";
import { ADMIN_COOKIE, adminCookie } from "@/server/admin";
import { createMatch } from "@/server/matches";
import { createPlayer } from "@/server/players";

/** 테스트용 관리자 비밀번호. 켜 두어야 "관리자만" 규칙이 동작한다 (비밀번호가 없으면 누구나 관리자). */
export const TEST_PASSCODE = "test-passcode";

export function protectWrites() {
  vi.stubEnv("ADMIN_PASSCODE", TEST_PASSCODE);
}

export function adminHeaders(): Record<string, string> {
  return { cookie: `${ADMIN_COOKIE}=${adminCookie().value}` };
}

type RequestOptions = { body?: unknown; headers?: Record<string, string> };

export function request(method: string, path: string, { body, headers = {} }: RequestOptions = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Route Handler 두 번째 인자. Next 16에서 params는 Promise다. */
export function context<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

/** 오늘로부터 days일 전(음수면 뒤)의 한국 날짜 YYYY-MM-DD */
export function kstDate(daysAgo: number) {
  const kstNow = new Date(Date.now() + 9 * 3_600_000);
  kstNow.setUTCDate(kstNow.getUTCDate() - daysAgo);
  return kstNow.toISOString().slice(0, 10);
}

export function seedPlayer(name = "이무성") {
  return createPlayer({ name, positions: ["CB", "LB"] });
}

const baseMatch: MatchInput = {
  playedAt: kstDate(1),
  kickoffTime: null,
  opponent: "망원 FC",
  ourScore: 2,
  theirScore: 1,
  location: null,
  memo: null,
  voteDeadline: null,
  formationId: null,
  goals: [],
};

export function seedPlayedMatch(overrides: Partial<MatchInput> = {}) {
  return createMatch({ ...baseMatch, ...overrides });
}

export function seedUpcomingMatch(overrides: Partial<MatchInput> = {}) {
  return createMatch({ ...baseMatch, playedAt: kstDate(-5), ourScore: null, theirScore: null, ...overrides });
}
