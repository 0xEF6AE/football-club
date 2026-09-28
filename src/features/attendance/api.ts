import { api } from "@/lib/api-client";
import type { Attendance, AttendanceInput, CommentInput, MatchComment } from "./schema";

export const attendanceApi = {
  list: (matchId: string) => api<Attendance[]>(`/api/matches/${matchId}/attendance`),
  set: ({ matchId, input }: { matchId: string; input: AttendanceInput }) =>
    api<Attendance>(`/api/matches/${matchId}/attendance`, { method: "PUT", json: input }),
  remove: ({ matchId, playerId }: { matchId: string; playerId: string }) =>
    api<void>(`/api/matches/${matchId}/attendance`, { method: "DELETE", json: { playerId } }),

  comments: (matchId: string) => api<MatchComment[]>(`/api/matches/${matchId}/comments`),
  addComment: ({ matchId, input }: { matchId: string; input: CommentInput }) =>
    api<MatchComment>(`/api/matches/${matchId}/comments`, { method: "POST", json: input }),
  /** playerId는 "내 이름"(본인 댓글 삭제용). 관리자는 없어도 된다. */
  removeComment: ({ matchId, commentId, playerId }: { matchId: string; commentId: string; playerId: string | null }) =>
    api<void>(`/api/matches/${matchId}/comments/${commentId}`, { method: "DELETE", json: { playerId } }),
};
