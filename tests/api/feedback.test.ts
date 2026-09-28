import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as feedbackRoute from "@/app/api/matches/[id]/feedback/route";
import { db } from "@/lib/db";
import { feedbacks } from "@/lib/db/schema";
import { FEEDBACK_RATE_LIMITS } from "@/server/feedback";
import { context, kstDate, protectWrites, request, seedPlayedMatch, seedUpcomingMatch } from "./helpers";

const post = (matchId: string, headers: Record<string, string> = {}, content = "후반 압박이 좋았어요") =>
  feedbackRoute.POST(
    request("POST", `/api/matches/${matchId}/feedback`, { body: { category: "good", content }, headers }),
    context({ id: matchId }),
  );

/** 테스트끼리 도배 제한 카운트가 섞이지 않게 매번 비운다 */
beforeEach(async () => {
  protectWrites();
  await db.delete(feedbacks);
});

describe("익명 피드백: 작성자 정보는 받지도 저장하지도 않는다", () => {
  const identifying = {
    "x-forwarded-for": "203.0.113.77",
    "x-real-ip": "203.0.113.77",
    "user-agent": "SneakyPhone/1.0",
    cookie: "fc_admin=whatever; tracker=abc123",
  };

  it("저장된 행에는 경기·종류·내용·시각만 있고, 요청 헤더 값은 어디에도 없다", async () => {
    const match = await seedPlayedMatch();
    const response = await post(match.id, identifying);
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toBeNull();

    const rows = await db.select().from(feedbacks);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["category", "content", "createdAt", "id", "matchId"]);
    const stored = JSON.stringify(rows);
    for (const value of ["203.0.113.77", "SneakyPhone", "abc123", "whatever"]) expect(stored).not.toContain(value);
  });

  it("feedbacks 테이블에 작성자를 담을 수 있는 열이 생기면 실패한다", async () => {
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(feedbacks)`);
    expect(columns.map((c) => c.name).sort()).toEqual(["category", "content", "created_at", "id", "match_id"]);
  });

  it("피드백 작성 코드는 요청 헤더·쿠키·IP를 읽지 않는다", () => {
    const sources = ["src/app/api/matches/[id]/feedback/route.ts", "src/server/feedback.ts"].map((file) =>
      readFileSync(resolve(import.meta.dirname, "../..", file), "utf8"),
    );
    for (const source of sources) {
      expect(source).not.toMatch(/\.headers\b|\.cookies\b|x-forwarded|x-real-ip|\.ip\b|user-agent/i);
    }
  });
});

describe("피드백 마감: 결과가 있는 경기에만, 경기 후 2주까지", () => {
  it("경기 14일 뒤(마지막 날)까지는 받는다", async () => {
    const match = await seedPlayedMatch({ playedAt: kstDate(14) });
    expect((await post(match.id)).status).toBe(201);
  });

  it("15일이 지나면 403", async () => {
    const match = await seedPlayedMatch({ playedAt: kstDate(15) });
    expect((await post(match.id)).status).toBe(403);
  });

  it("아직 결과가 없는 예정 경기에는 400", async () => {
    const match = await seedUpcomingMatch();
    expect((await post(match.id)).status).toBe(400);
  });
});

describe("피드백 도배 방지", () => {
  it(`한 경기에 ${FEEDBACK_RATE_LIMITS.perMatch.max}개를 넘기면 429, 다른 경기는 계속 받는다`, async () => {
    // 로컬 SQLite 연결 하나에서 트랜잭션이 겹치지 않게 준비는 순서대로 한다.
    const flooded = await seedPlayedMatch();
    const calm = await seedPlayedMatch({ opponent: "성수 유나이티드" });
    for (let i = 0; i < FEEDBACK_RATE_LIMITS.perMatch.max; i++) {
      expect((await post(flooded.id, {}, `피드백 ${i}`)).status).toBe(201);
    }
    expect((await post(flooded.id)).status).toBe(429);
    expect((await post(calm.id)).status).toBe(201);
  });

  it(`사이트 전체로 1분에 ${FEEDBACK_RATE_LIMITS.global.max}개를 넘기면 429`, async () => {
    const { perMatch, global } = FEEDBACK_RATE_LIMITS;
    const matchCount = Math.ceil(global.max / (perMatch.max - 1));
    const matches = [];
    for (let i = 0; i <= matchCount; i++) matches.push(await seedPlayedMatch({ opponent: `상대 ${i}` }));
    let sent = 0;
    for (const match of matches.slice(0, matchCount)) {
      for (let i = 0; i < perMatch.max - 1 && sent < global.max; i++, sent++) {
        expect((await post(match.id)).status).toBe(201);
      }
    }
    expect((await post(matches[matchCount].id)).status).toBe(429);
  });

  it("제한은 시간이 지나면 풀린다 (최근 글만 센다)", async () => {
    const match = await seedPlayedMatch();
    const old = new Date(Date.now() - FEEDBACK_RATE_LIMITS.perMatch.windowMs - 1000).toISOString();
    await db.insert(feedbacks).values(
      Array.from({ length: FEEDBACK_RATE_LIMITS.perMatch.max }, () => ({
        id: crypto.randomUUID(),
        matchId: match.id,
        category: "good" as const,
        content: "예전 글",
        createdAt: old,
      })),
    );
    expect((await post(match.id)).status).toBe(201);
  });
});

// withErrorHandling이 예상 못 한 오류만 console.error로 남긴다. 이 파일에서 그런 오류가 나면 안 된다.
vi.spyOn(console, "error").mockImplementation((...args) => {
  throw new Error(`예상 못 한 서버 오류: ${args.join(" ")}`);
});
