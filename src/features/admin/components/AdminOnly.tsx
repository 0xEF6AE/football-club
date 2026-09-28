"use client";

import { useAdmin } from "../queries";

/** 관리자일 때만 자식을 그린다. 서버 컴포넌트 안에서도 감쌀 수 있다. */
export function AdminOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { isAdmin } = useAdmin();
  return <>{isAdmin ? children : fallback}</>;
}
