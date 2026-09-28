"use client";

import { useEffect, useReducer, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, InlineError } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { isPlayed, isVoteClosed, type Match } from "@/features/matches/schema";
import { usePlayers } from "@/features/players/queries";
import { getErrorMessage } from "@/lib/api-client";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { cn, formatDateTime } from "@/lib/utils";
import { useAttendance, useRemoveAttendance, useSetAttendance } from "../queries";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, ATTENDANCE_TONE, type AttendanceStatus } from "../schema";
import { CommentThread } from "./CommentThread";

function readMe(): string {
  const stored = readStorage(STORAGE_KEYS.me);
  return typeof stored === "string" ? stored : "";
}

/** 마감 시각이 지나는 순간 화면이 스스로 바뀌도록, 마감까지 남은 시간 뒤에 한 번 다시 그린다. */
function useDeadlineTick(deadline: string | null) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!deadline) return;
    const remaining = new Date(deadline).getTime() - Date.now();
    if (!(remaining > 0)) return;
    const timer = setTimeout(tick, Math.min(remaining, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [deadline]);
}

/**
 * 경기별 참석 투표. 이름을 고르고 참석/불참/보류를 누른다 (신뢰 기반, 로그인 없음).
 * 마감 시각이 지나면 응답을 바꿀 수 없고, 아래 댓글로 사정을 남긴다.
 * 고른 이름은 이 기기에 기억해 다음 경기부터는 한 번만 누르면 된다.
 */
export function AttendanceSection({ match }: { match: Match }) {
  const matchId = match.id;
  const played = isPlayed(match);
  const players = usePlayers();
  const attendance = useAttendance(matchId);
  const set = useSetAttendance(matchId);
  const remove = useRemoveAttendance(matchId);
  const { isAdmin, isProtected } = useAdmin();
  // 이 컴포넌트는 데이터를 받은 뒤 브라우저에서만 그려지므로 초기값을 localStorage에서 바로 읽어도 안전하다.
  const [me, setMe] = useState(readMe);
  useDeadlineTick(match.voteDeadline);

  if (players.isPending || attendance.isPending) return <ListSkeleton rows={2} />;

  if (players.isError || attendance.isError) {
    const error = players.error ?? attendance.error;
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => {
          void players.refetch();
          void attendance.refetch();
        }}
        retrying={players.isFetching || attendance.isFetching}
      />
    );
  }

  const list = players.data;
  const nameOf = new Map(list.map((p) => [p.id, p.name]));
  const statusOf = new Map(attendance.data.map((a) => [a.playerId, a.status]));
  const myStatus = me ? statusOf.get(me) : undefined;
  const byStatus = (status: AttendanceStatus) =>
    attendance.data.filter((a) => a.status === status && nameOf.has(a.playerId)).map((a) => nameOf.get(a.playerId)!);
  const noResponse = list.filter((p) => !statusOf.has(p.id)).map((p) => p.name);
  const mutationError = set.isError ? set.error : remove.isError ? remove.error : null;

  const closed = isVoteClosed(match);
  // 서버(attendance route)와 같은 규칙: 비밀번호가 걸린 배포에서만 관리자가 마감 뒤에도 고칠 수 있다.
  const adminOverride = closed && isAdmin && isProtected;
  const canVote = !closed || adminOverride;

  const chooseMe = (playerId: string) => {
    setMe(playerId);
    writeStorage(STORAGE_KEYS.me, playerId);
  };

  const note = !me
    ? "이름을 고르면 참석 여부를 누를 수 있어요."
    : adminOverride
      ? "마감됐지만 관리자는 명단을 고칠 수 있어요."
      : closed
        ? "투표가 마감돼 응답을 바꿀 수 없어요. 사정이 생겼으면 아래 댓글로 알려 주세요."
        : match.voteDeadline
          ? "응답은 모임원 모두에게 보이고, 마감 전까지 바꿀 수 있어요."
          : "응답은 모임원 모두에게 보이고, 언제든 바꿀 수 있어요.";

  return (
    <section aria-labelledby="attendance-heading" className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="attendance-heading" className="text-lg font-semibold">
          {played ? "참석 명단" : "참석 투표"}{" "}
          <span className="font-display text-base font-normal text-muted">{byStatus("yes").length}</span>
        </h2>
        <p className="text-xs text-muted">전체 {list.length}명</p>
      </div>

      {match.voteDeadline && (
        <p className={cn("flex items-center gap-1.5 text-sm", closed ? "text-muted" : "text-fg")} role="status">
          <Clock className="size-4 shrink-0" aria-hidden />
          {closed ? (
            <>
              <time dateTime={match.voteDeadline}>{formatDateTime(match.voteDeadline)}</time>에 마감됐어요
            </>
          ) : (
            <>
              <time dateTime={match.voteDeadline}>{formatDateTime(match.voteDeadline)}</time>까지 받아요
            </>
          )}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">선수가 등록되면 참석 여부를 받을 수 있어요.</p>
      ) : (
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="내 이름"
              value={me}
              onChange={(e) => chooseMe(e.target.value)}
              className="min-w-40 flex-1 [&>select]:bg-surface"
            >
              <option value="">내 이름 고르기</option>
              {list.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </Select>
            <div role="group" aria-label="참석 여부" className="flex gap-1.5">
              {ATTENDANCE_STATUSES.map((status) => (
                <Chip
                  key={status}
                  size="sm"
                  tone={ATTENDANCE_TONE[status]}
                  pressed={myStatus === status}
                  disabled={!me || !canVote || set.isPending || remove.isPending}
                  onClick={() => set.mutate({ matchId, input: { playerId: me, status } })}
                >
                  {ATTENDANCE_LABEL[status]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{note}</p>
            {myStatus && canVote && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted"
                onClick={() => remove.mutate({ matchId, playerId: me })}
                pending={remove.isPending}
              >
                응답 지우기
              </Button>
            )}
          </div>
          <InlineError>{mutationError ? getErrorMessage(mutationError) : null}</InlineError>
        </form>
      )}

      {attendance.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {ATTENDANCE_STATUSES.map((status) => {
            const names = byStatus(status);
            return (
              <div key={status}>
                <p className="mb-1.5 text-xs font-medium text-muted">
                  {ATTENDANCE_LABEL[status]} <span className="font-display">{names.length}</span>
                </p>
                {names.length === 0 ? (
                  <p className="text-sm text-muted/70">없음</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {names.map((name) => (
                      <li key={name} className="rounded-md border border-line bg-surface px-2 py-1 text-sm">
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {noResponse.length > 0 && attendance.data.length > 0 && (
        <p className="text-xs leading-relaxed text-muted">
          아직 응답 없음 {noResponse.length}명: {noResponse.join(", ")}
        </p>
      )}

      {list.length > 0 && (
        <CommentThread matchId={matchId} me={me} myName={nameOf.get(me) ?? null} statusOf={statusOf} />
      )}
    </section>
  );
}
