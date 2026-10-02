import { api } from "@/lib/api-client";
import type { Attendance, AttendanceInput, CommentInput, GuestInput, MatchComment, MatchGuest } from "./schema";

export const attendanceApi = {
  list: (matchId: string) => api<Attendance[]>(`/api/matches/${matchId}/attendance`),
  set: ({ matchId, input }: { matchId: string; input: AttendanceInput }) =>
    api<Attendance>(`/api/matches/${matchId}/attendance`, { method: "PUT", json: input }),
  remove: ({ matchId, playerId, pin }: { matchId: string; playerId: string; pin?: string }) =>
    api<void>(`/api/matches/${matchId}/attendance`, { method: "DELETE", json: { playerId, pin } }),

  guests: (matchId: string) => api<MatchGuest[]>(`/api/matches/${matchId}/guests`),
  /** 관리자 전용 */
  addGuest: ({ matchId, input }: { matchId: string; input: GuestInput }) =>
    api<MatchGuest>(`/api/matches/${matchId}/guests`, { method: "POST", json: input }),
  /** 관리자 전용 */
  removeGuest: ({ matchId, guestId }: { matchId: string; guestId: string }) =>
    api<void>(`/api/matches/${matchId}/guests/${guestId}`, { method: "DELETE" }),

  comments: (matchId: string) => api<MatchComment[]>(`/api/matches/${matchId}/comments`),
  addComment: ({ matchId, input }: { matchId: string; input: CommentInput }) =>
    api<MatchComment>(`/api/matches/${matchId}/comments`, { method: "POST", json: input }),
  /** playerId·pin은 "내 이름"과 그 PIN(본인 댓글 삭제용). 관리자는 없어도 된다. */
  removeComment: ({
    matchId,
    commentId,
    playerId,
    pin,
  }: {
    matchId: string;
    commentId: string;
    playerId: string | null;
    pin?: string;
  }) => api<void>(`/api/matches/${matchId}/comments/${commentId}`, { method: "DELETE", json: { playerId, pin } }),
};
