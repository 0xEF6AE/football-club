import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "./api";

export const attendanceKeys = {
  all: ["attendance"] as const,
  byMatch: (matchId: string) => [...attendanceKeys.all, matchId] as const,
  comments: (matchId: string) => [...attendanceKeys.all, "comments", matchId] as const,
  guests: (matchId: string) => [...attendanceKeys.all, "guests", matchId] as const,
};

export function useGuests(matchId: string) {
  return useQuery({ queryKey: attendanceKeys.guests(matchId), queryFn: () => attendanceApi.guests(matchId) });
}

export function useAddGuest(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.addGuest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.guests(matchId) }),
  });
}

export function useRemoveGuest(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.removeGuest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.guests(matchId) }),
  });
}

export function useAttendance(matchId: string) {
  return useQuery({
    queryKey: attendanceKeys.byMatch(matchId),
    queryFn: () => attendanceApi.list(matchId),
  });
}

export function useSetAttendance(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.set,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.byMatch(matchId) }),
  });
}

export function useRemoveAttendance(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.byMatch(matchId) }),
  });
}

export function useComments(matchId: string) {
  return useQuery({
    queryKey: attendanceKeys.comments(matchId),
    queryFn: () => attendanceApi.comments(matchId),
  });
}

export function useAddComment(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.addComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.comments(matchId) }),
  });
}

export function useRemoveComment(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.removeComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.comments(matchId) }),
  });
}
