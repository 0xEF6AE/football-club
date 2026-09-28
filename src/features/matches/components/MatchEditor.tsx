"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { useCreateMatch, useMatch, useUpdateMatch } from "../queries";
import { MatchForm } from "./MatchForm";

export function MatchCreate() {
  const router = useRouter();
  const create = useCreateMatch();

  return (
    <MatchForm
      submitLabel="기록 저장"
      pending={create.isPending}
      cancelHref="/matches"
      onSubmit={async (input) => {
        const match = await create.mutateAsync(input);
        router.replace(`/matches/${match.id}`);
      }}
    />
  );
}

export function MatchEdit({ id }: { id: string }) {
  const router = useRouter();
  const query = useMatch(id);
  const update = useUpdateMatch();

  if (query.isPending) return <FormSkeleton />;

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <MatchNotFound />;
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  return (
    <MatchForm
      key={query.data.id}
      initial={query.data}
      submitLabel="수정 저장"
      pending={update.isPending}
      cancelHref={`/matches/${id}`}
      onSubmit={async (input) => {
        await update.mutateAsync({ id, input });
        router.replace(`/matches/${id}`);
      }}
    />
  );
}

export function MatchNotFound() {
  return (
    <EmptyState
      title="경기를 찾을 수 없어요"
      description="삭제됐거나 주소가 잘못됐을 수 있어요."
      action={
        <Link href="/matches" className={buttonStyles({ variant: "secondary" })}>
          경기 목록으로
        </Link>
      }
    />
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="불러오는 중">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-16" />
      <Skeleton className="h-32" />
    </div>
  );
}
