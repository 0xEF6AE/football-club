import { api } from "@/lib/api-client";
import type { Feedback, FeedbackInput } from "./schema";

export const feedbackApi = {
  list: (matchId: string) => api<Feedback[]>(`/api/matches/${matchId}/feedback`),
  create: ({ matchId, input }: { matchId: string; input: FeedbackInput }) =>
    api<Feedback>(`/api/matches/${matchId}/feedback`, { method: "POST", json: input }),
  /** 관리자 전용 */
  remove: ({ matchId, feedbackId }: { matchId: string; feedbackId: string }) =>
    api<void>(`/api/matches/${matchId}/feedback/${feedbackId}`, { method: "DELETE" }),
};
