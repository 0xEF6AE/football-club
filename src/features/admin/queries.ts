import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "./api";
import type { AdminStatus } from "./schema";

export const adminKeys = {
  status: ["admin", "status"] as const,
};

/**
 * 관리자 여부. 불러오기 전에는 관리자가 아닌 것으로 취급해 편집 버튼을 잠깐 숨긴다
 * (잠깐 보였다 사라지는 것보다 낫다).
 */
export function useAdmin() {
  const query = useQuery({
    queryKey: adminKeys.status,
    queryFn: adminApi.status,
    staleTime: Infinity,
  });
  return {
    isAdmin: query.data?.admin ?? false,
    isProtected: query.data?.protected ?? true,
    isLoading: query.isPending,
  };
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.login,
    onSuccess: (status) => queryClient.setQueryData<AdminStatus>(adminKeys.status, status),
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.logout,
    onSuccess: () =>
      queryClient.setQueryData<AdminStatus>(adminKeys.status, (prev) => ({
        protected: prev?.protected ?? true,
        admin: false,
      })),
  });
}
