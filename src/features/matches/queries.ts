import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { matchesApi } from "./api";
import type { Match } from "./schema";

export const matchKeys = {
  all: ["matches"] as const,
  list: () => [...matchKeys.all, "list"] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
};

export function useMatches() {
  return useQuery({ queryKey: matchKeys.list(), queryFn: matchesApi.list });
}

export function useMatch(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: matchKeys.detail(id),
    queryFn: () => matchesApi.get(id),
    // 목록에서 들어온 경우 목록 캐시로 먼저 그리고, 백그라운드에서 최신 데이터를 받는다.
    placeholderData: () =>
      queryClient.getQueryData<Match[]>(matchKeys.list())?.find((match) => match.id === id),
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: matchesApi.create,
    onSuccess: (match) => {
      queryClient.setQueryData(matchKeys.detail(match.id), match);
      return queryClient.invalidateQueries({ queryKey: matchKeys.list() });
    },
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: matchesApi.update,
    onSuccess: (match) => {
      queryClient.setQueryData(matchKeys.detail(match.id), match);
      return queryClient.invalidateQueries({ queryKey: matchKeys.list() });
    },
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: matchesApi.remove,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: matchKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: matchKeys.list() });
    },
  });
}

export function useCancelMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: matchesApi.setCancelled,
    onSuccess: (match) => {
      queryClient.setQueryData(matchKeys.detail(match.id), match);
      return queryClient.invalidateQueries({ queryKey: matchKeys.list() });
    },
  });
}
