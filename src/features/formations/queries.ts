import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formationsApi } from "./api";

export const formationKeys = {
  all: ["formations"] as const,
  list: () => [...formationKeys.all, "list"] as const,
};

export function useFormations() {
  return useQuery({ queryKey: formationKeys.list(), queryFn: formationsApi.list });
}

export function useCreateFormation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: formationsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formationKeys.all }),
  });
}

export function useUpdateFormation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: formationsApi.update,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formationKeys.all }),
  });
}

export function useDeleteFormation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: formationsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formationKeys.all }),
  });
}
