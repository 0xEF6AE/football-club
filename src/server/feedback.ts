import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks } from "@/lib/db/schema";
import type { Feedback, FeedbackInput } from "@/features/feedback/schema";

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
