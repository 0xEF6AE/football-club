import { and, asc, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks } from "@/lib/db/schema";
import type { Feedback, FeedbackInput } from "@/features/feedback/schema";

/**
 * 도배 방지. 작성자를 전혀 식별하지 않고, 이미 저장하는 작성 시각(createdAt)으로 최근 글 수만 센다.
 * DB로 세므로 서버리스(요청마다 다른 인스턴스)에서도 제한이 유지된다.
 */
export const FEEDBACK_RATE_LIMITS = {
  /** 한 경기에 10분 동안 */
  perMatch: { max: 20, windowMs: 10 * 60_000 },
  /** 사이트 전체에 1분 동안 */
  global: { max: 40, windowMs: 60_000 },
} as const;

/** 제한에 걸리면 true */
export async function isFeedbackRateLimited(matchId: string, now = new Date()): Promise<boolean> {
  const since = (windowMs: number) => new Date(now.getTime() - windowMs).toISOString();
  const { perMatch, global } = FEEDBACK_RATE_LIMITS;
  const [[matchRow], [globalRow]] = await Promise.all([
    db
      .select({ n: count() })
      .from(feedbacks)
      .where(and(eq(feedbacks.matchId, matchId), gte(feedbacks.createdAt, since(perMatch.windowMs)))),
    db.select({ n: count() }).from(feedbacks).where(gte(feedbacks.createdAt, since(global.windowMs))),
  ]);
  return matchRow.n >= perMatch.max || globalRow.n >= global.max;
}

export async function listFeedback(matchId: string): Promise<Feedback[]> {
  return db.select().from(feedbacks).where(eq(feedbacks.matchId, matchId)).orderBy(asc(feedbacks.createdAt));
}

/** 익명 피드백: 요청자 식별 정보(IP, UA, 쿠키 등)는 의도적으로 받지도, 저장하지도 않는다. */
export async function createFeedback(matchId: string, input: FeedbackInput): Promise<Feedback> {
  const [row] = await db
    .insert(feedbacks)
    .values({ id: crypto.randomUUID(), matchId, ...input })
    .returning();
  return row;
}

/** 관리자 전용. 작성자는 익명이라 본인 삭제가 없고, 부적절한 글만 관리자가 지운다. */
export async function deleteFeedback(matchId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(feedbacks)
    .where(and(eq(feedbacks.id, id), eq(feedbacks.matchId, matchId)))
    .returning({ id: feedbacks.id });
  return deleted.length > 0;
}
