import { readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminHeaders, context, protectWrites, request } from "./helpers";

/**
 * "등록·수정·삭제는 관리자만" 규칙.
 * src/app/api 아래 모든 route.ts를 자동으로 모아, 쓰기 메서드(POST/PUT/PATCH/DELETE)는
 * 아래 허용 목록에 없으면 관리자 쿠키 없이 401이어야 한다.
 * 새 쓰기 API를 만들고 requireAdmin을 빠뜨리면 이 테스트가 잡는다.
 * 모임원 누구나 써야 하는 API는 이유와 함께 여기에 적는다.
 */
const OPEN_TO_MEMBERS: Record<string, string> = {
  "POST /api/admin": "관리자 로그인",
  "DELETE /api/admin": "관리자 로그아웃",
  "PUT /api/matches/[id]/attendance": "참석 응답 (선수 PIN으로 본인 확인)",
  "DELETE /api/matches/[id]/attendance": "참석 응답 지우기 (선수 PIN)",
  "POST /api/matches/[id]/comments": "투표 댓글 (선수 PIN)",
  "DELETE /api/matches/[id]/comments/[commentId]": "본인 댓글 삭제 (선수 PIN) 또는 관리자",
  "POST /api/matches/[id]/feedback": "익명 피드백",
};

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

const apiDir = resolve(import.meta.dirname, "../../src/app/api");
const routeFiles = readdirSync(apiDir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith("route.ts"));
const routeModules: [string, Partial<Record<string, Handler>>][] = await Promise.all(
  routeFiles.map(async (file) => [file, await import(join(apiDir, file))] as [string, Partial<Record<string, Handler>>]),
);

/** "matches/[id]/route.ts" → "/api/matches/[id]" */
const toRoutePath = (file: string) => `/api/${file.split(sep).join("/")}`.replace(/\/route\.ts$/, "");

const writeEndpoints = routeModules.flatMap(([file, mod]) =>
  WRITE_METHODS.filter((method) => typeof mod[method] === "function").map((method) => ({
    method,
    route: toRoutePath(file),
    handler: mod[method] as Handler,
  })),
);

const guarded = writeEndpoints.filter(({ method, route }) => !(`${method} ${route}` in OPEN_TO_MEMBERS));

/** "[id]" 같은 동적 세그먼트를 가짜 값으로 채운 URL과 params */
function fill(route: string) {
  const params: Record<string, string> = {};
  const path = route.replace(/\[(\w+)\]/g, (_, name: string) => {
    params[name] = `missing-${name}`;
    return params[name];
  });
  return { path, params };
}

beforeEach(() => {
  protectWrites();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("관리자 전용 쓰기 API", () => {
  it("검사할 API를 실제로 찾았다 (목록이 비어 그냥 통과하는 일 방지)", () => {
    expect(guarded.length).toBeGreaterThanOrEqual(10);
  });

  it("허용 목록의 API는 실제로 존재한다 (이름이 바뀌어 목록이 낡는 일 방지)", () => {
    const existing = new Set(writeEndpoints.map(({ method, route }) => `${method} ${route}`));
    expect(Object.keys(OPEN_TO_MEMBERS).filter((key) => !existing.has(key))).toEqual([]);
  });

  it.each(guarded.map((e) => [`${e.method} ${e.route}`, e] as const))(
    "%s 는 관리자 쿠키 없이 401",
    async (_label, { method, route, handler }) => {
      const { path, params } = fill(route);
      const response = await handler(request(method, path, { body: {} }), context(params));
      expect(response.status).toBe(401);
    },
  );

  it("잘못된 관리자 쿠키도 401", async () => {
    const { POST } = await import("@/app/api/players/route");
    const response = await POST(
      request("POST", "/api/players", { body: { name: "가짜", positions: ["ST"] }, headers: { cookie: "fc_admin=forged" } }),
      context({}),
    );
    expect(response.status).toBe(401);
  });

  it("관리자 쿠키가 있으면 통과한다", async () => {
    const { POST } = await import("@/app/api/players/route");
    const response = await POST(
      request("POST", "/api/players", { body: { name: "신입", positions: ["ST"] }, headers: adminHeaders() }),
      context({}),
    );
    expect(response.status).toBe(201);
  });
});
