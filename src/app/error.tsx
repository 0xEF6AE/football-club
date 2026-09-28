"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-12">
      <ErrorState message="화면을 그리는 중 문제가 생겼어요. 다시 시도해 주세요." onRetry={retry} />
    </div>
  );
}
