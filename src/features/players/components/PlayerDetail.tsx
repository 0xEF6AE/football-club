"use client";

import Link from "next/link";
import { ChevronLeft, Trophy, UserRoundX } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES } from "@/features/attendance/schema";
import { ResultMark } from "@/features/matches/components/MatchList";
import { formatRecord } from "@/features/matches/stats";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { cn, formatMatchDate } from "@/lib/utils";
import { usePlayerStats } from "../queries";
import { APPEARANCE_SOURCE_LABEL, type PlayerMatchLine, type PlayerStats } from "../stats";

const panelStyles =
  "rounded-xl bg-pitch-deep px-5 py-6 text-on-pitch shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]";

function Tile({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-on-pitch/70">{label}</span>
      <span className="font-display text-4xl leading-none text-amber">
        {value}
        {unit && <span className="ml-0.5 text-lg text-on-pitch/70">{unit}</span>}
      </span>
    </div>
  );
}

/** 전광판: 출전·골·도움·참석률 네 숫자와 그 아래 한 줄 요약 */
function StatsPanel({ stats }: { stats: PlayerStats }) {
  const rate = stats.attendanceRate;
  return (
    <section aria-label="개인 기록" className={panelStyles}>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="출전" value={stats.appearances} />
        <Tile label="골" value={stats.goals} />
        <Tile label="도움" value={stats.assists} />
        <Tile label="참석률" value={rate === null ? "-" : Math.round(rate * 100)} unit={rate === null ? undefined : "%"} />
      </div>
      <p className="mt-4 text-center text-sm text-on-pitch/75">
        {stats.teamPlayed === 0 ? (
          "아직 결과가 기록된 경기가 없어요."
        ) : (
          <>
            팀 <span className="font-display text-on-pitch">{stats.teamPlayed}</span>경기 중{" "}
            <span className="font-display text-on-pitch">{stats.appearances}</span>경기 출전
            {stats.appearances > 0 && (
              <>
                <span className="mx-1.5 text-on-pitch/40">|</span>
                출전 시 <span className="font-display tracking-wide text-on-pitch">{formatRecord(stats.record)}</span>
              </>
            )}
          </>
        )}
      </p>
    </section>
  );
}

function MatchRow({ line }: { line: PlayerMatchLine }) {
  const contribution = [line.goals > 0 && `골 ${line.goals}`, line.assists > 0 && `도움 ${line.assists}`]
    .filter(Boolean)
    .join(" · ");
  const basis = line.sources.map((s) => APPEARANCE_SOURCE_LABEL[s]).join(", ");

  return (
    <li>
      <Link
        href={`/matches/${line.matchId}`}
        className={cn(
          "-mx-2 flex items-center gap-3 rounded-lg px-2 py-3.5 outline-none transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70",
          !line.appeared && "opacity-60",
        )}
      >
        <time dateTime={line.playedAt} className="w-20 shrink-0 text-sm text-muted">
          {formatMatchDate(line.playedAt)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{line.opponent}</p>
          <p className="truncate text-xs text-muted" title={line.appeared ? `출전 근거: ${basis}` : undefined}>
            {line.appeared ? contribution || "출전" : "결장"}
          </p>
        </div>
        <ResultMark result={line.result} />
        <p className="font-display w-14 shrink-0 text-right text-xl leading-none">
          {line.ourScore}
          <span className="mx-1 text-muted">:</span>
          {line.theirScore}
        </p>
      </Link>
    </li>
  );
}

function PlayerNotFound() {
  return (
    <EmptyState
      icon={<UserRoundX />}
      title="선수를 찾을 수 없어요"
      description="지워졌거나 주소가 잘못됐을 수 있어요."
      action={
        <Link href="/players" className={buttonStyles({ variant: "secondary" })}>
          선수 목록으로
        </Link>
      }
    />
  );
}

export function PlayerDetail({ id }: { id: string }) {
  const query = usePlayerStats(id);

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <PlayerNotFound />;
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const stats = query.data;
  const { player } = stats;
  const totalVotes = ATTENDANCE_STATUSES.reduce((sum, status) => sum + stats.votes[status], 0);

  return (
    <article className="flex flex-col gap-6">
      <div>
        <Link href="/players" className={buttonStyles({ variant: "ghost", size: "sm", className: "-ml-2 text-muted" })}>
          <ChevronLeft className="size-4" aria-hidden />
          선수 목록
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{player.name}</h1>
        <p className="font-display mt-1.5 flex flex-wrap gap-1 text-xs tracking-wide" aria-label="가능 포지션">
          {player.positions.map((position, index) => (
            <span
              key={position}
              className={cn("rounded px-1.5 py-0.5", index === 0 ? "bg-pitch text-on-pitch" : "bg-surface-2 text-muted")}
            >
              {position}
            </span>
          ))}
        </p>
      </header>

      <StatsPanel stats={stats} />

      <div className="flex flex-col gap-1 text-xs text-muted">
        {totalVotes > 0 && (
          <p>
            참석 투표 응답{" "}
            {ATTENDANCE_STATUSES.map((status) => (
              <span key={status} className="ml-2">
                {ATTENDANCE_LABEL[status]} <span className="font-display text-sm text-fg">{stats.votes[status]}</span>
              </span>
            ))}
          </p>
        )}
        <p>
          출전은 참석 투표에서 &ldquo;참석&rdquo;, 경기에 붙인 포메이션 명단, 골·도움 기록 중 하나라도 있으면 세요.
        </p>
      </div>

      {stats.matches.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="아직 기록된 경기가 없어요"
          description="경기 결과가 쌓이면 여기에 경기별 출전과 득점이 보여요."
        />
      ) : (
        <section aria-labelledby="player-matches-heading">
          <h2 id="player-matches-heading" className="mb-1 text-sm font-medium text-muted">
            경기별 기록 <span className="font-display">{stats.matches.length}</span>
          </h2>
          <ul className="divide-y divide-line">
            {stats.matches.map((line) => (
              <MatchRow key={line.matchId} line={line} />
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-40" />
    </div>
  );
}
