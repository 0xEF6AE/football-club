import { z } from "zod";

export const FEEDBACK_CATEGORIES = ["good", "improve", "idea"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  good: "좋았던 점",
  improve: "아쉬운 점",
  idea: "제안",
};

export const feedbackInputSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력해 주세요")
    .max(500, "500자까지 적을 수 있어요"),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

/**
 * 피드백은 결과가 기록된 경기에만, 경기 날짜로부터 FEEDBACK_WINDOW_DAYS일째 되는 날 끝(한국 시간 자정)까지 받는다.
 * 오래된 경기에 뒤늦게 글이 쌓이거나 도배되는 걸 막는다. 클라이언트와 서버가 같은 판정을 쓴다.
 */
export const FEEDBACK_WINDOW_DAYS = 14;

/** 피드백을 받는 마지막 날 (YYYY-MM-DD). 날짜만 다루므로 UTC 기준 날짜 연산으로 시간대 영향을 없앤다. */
export function feedbackLastDay(playedAt: string): string {
  const date = new Date(`${playedAt}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + FEEDBACK_WINDOW_DAYS);
  return date.toISOString().slice(0, 10);
}

type FeedbackTarget = { playedAt: string; ourScore: number | null; theirScore: number | null };

export function isFeedbackOpen(match: FeedbackTarget, now: Date = new Date()): boolean {
  if (match.ourScore === null || match.theirScore === null) return false;
  const closesAt = new Date(`${feedbackLastDay(match.playedAt)}T23:59:59.999+09:00`);
  return !Number.isNaN(closesAt.getTime()) && now <= closesAt;
}

export type Feedback = {
  id: string;
  matchId: string;
  category: FeedbackCategory;
  content: string;
  createdAt: string;
};
