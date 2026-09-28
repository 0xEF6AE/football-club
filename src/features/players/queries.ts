import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { matchKeys } from "@/features/matches/queries";
import { playersApi } from "./api";

export const playerKeys = {
  all: ["players"] as const,
  list: () => [...playerKeys.all, "list"] as const,
};

export function usePlayers() {
  return useQuery({ queryKey: playerKeys.list(), queryFn: playersApi.list });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: playersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playerKeys.all }),
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: playersApi.update,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: playerKeys.all }),
        // 이름이 바뀌면 경기 득점자 표시도 달라진다.
        queryClient.invalidateQueries({ queryKey: matchKeys.all }),
      ]),
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: playersApi.remove,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: playerKeys.all }),
        queryClient.invalidateQueries({ queryKey: matchKeys.all }),
      ]),
  });
}
