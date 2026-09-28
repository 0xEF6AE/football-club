"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { matchesApi } from "@/features/matches/api";
import { matchKeys } from "@/features/matches/queries";
import { playersApi } from "@/features/players/api";
import { playerKeys } from "@/features/players/queries";

/**
 * 거의 모든 화면이 쓰는 경기·선수 목록을 앱이 뜨자마자 받아 둔다.
 * "/" 스플래시가 도는 동안 받아지므로 경기 화면이 드러날 때 이미 채워져 있고,
 * 탭을 옮길 때도 캐시에서 바로 그린다.
 */
function WarmCoreData() {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery({ queryKey: matchKeys.list(), queryFn: matchesApi.list });
    void queryClient.prefetchQuery({ queryKey: playerKeys.list(), queryFn: playersApi.list });
  }, [queryClient]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // 요청마다(SSR) / 마운트마다 새 클라이언트를 만들어 사용자 간 캐시가 섞이지 않게 한다.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 모임 데이터는 자주 바뀌지 않는다. 1분 안에는 탭을 오가도 다시 받지 않고 캐시로 바로 그린다.
            // 변경은 각 mutation이 무효화하므로 내가 바꾼 건 즉시 반영된다.
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WarmCoreData />
      {children}
    </QueryClientProvider>
  );
}
