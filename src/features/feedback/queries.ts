import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { feedbackApi } from "./api";

export const feedbackKeys = {
  all: ["feedback"] as const,
  byMatch: (matchId: string) => [...feedbackKeys.all, matchId] as const,
};

export function useFeedback(matchId: string) {
  return useQuery({
    queryKey: feedbackKeys.byMatch(matchId),
    queryFn: () => feedbackApi.list(matchId),
  });
}

export function useCreateFeedback(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKeys.byMatch(matchId) }),
  });
}

export function useDeleteFeedback(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedbackApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKeys.byMatch(matchId) }),
  });
}
