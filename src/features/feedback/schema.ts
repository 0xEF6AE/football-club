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

export type Feedback = {
  id: string;
  matchId: string;
  category: FeedbackCategory;
  content: string;
  createdAt: string;
};
