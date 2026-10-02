import { api } from "@/lib/api-client";
import type { CancelInput, Match, MatchInput } from "./schema";

export const matchesApi = {
  list: () => api<Match[]>("/api/matches"),
  get: (id: string) => api<Match>(`/api/matches/${id}`),
  create: (input: MatchInput) => api<Match>("/api/matches", { method: "POST", json: input }),
  update: ({ id, input }: { id: string; input: MatchInput }) =>
    api<Match>(`/api/matches/${id}`, { method: "PATCH", json: input }),
  remove: (id: string) => api<void>(`/api/matches/${id}`, { method: "DELETE" }),
  /** 관리자 전용: 추가 모집 마감 정하기 (null = 기본, 킥오프 2시간 뒤) */
  setLateJoinDeadline: ({ id, deadline }: { id: string; deadline: string | null }) =>
    api<Match>(`/api/matches/${id}/late-join`, { method: "PUT", json: { deadline } }),
  /** 관리자 전용: 경기 취소 또는 되돌리기 */
  setCancelled: ({ id, input }: { id: string; input: CancelInput }) =>
    api<Match>(`/api/matches/${id}/cancel`, { method: "POST", json: input }),
};
