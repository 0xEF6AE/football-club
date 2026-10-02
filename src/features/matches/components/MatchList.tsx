"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { AdminOnly } from "@/features/admin/components/AdminOnly";
import { getErrorMessage } from "@/lib/api-client";
import { cn, daysUntil, formatDday, formatKickoffTime, formatMatchDate, formatMatchDay, formatMonth } from "@/lib/utils";
import { useMatches } from "../queries";
import {
  getMatchResult,
  isAwaitingResult,
  isPlayed,
  isVoteClosed,
  MATCH_RESULT_LABEL,
  splitMatches,
  summarizeScorers,
  type Match,
  type MatchResult,
} from "../schema";
import { SeasonBoard } from "./SeasonBoard";

const RESULT_STYLE: Record<MatchResult, string> = {
  win: "bg-win/12 text-win",
  draw: "bg-draw/12 text-draw",
  loss: "bg-loss/12 text-loss",
};

export function ResultMark({ result, className }: { result: MatchResult; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-sm text-xs font-semibold",
        RESULT_STYLE[result],
        className,
      )}
    >
      {MATCH_RESULT_LABEL[result]}
    </span>
  );
}

const rowStyles =
  "-mx-2 flex items-center gap-3 rounded-lg px-2 py-3.5 outline-none transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70";

function PlayedRow({ match }: { match: Match }) {
  if (!isPlayed(match)) return null;
  const result = getMatchResult(match);
  const scorers = summarizeScorers(match.goals);

  return (
    <li>
      <Link href={`/matches/${match.id}`} className={rowStyles}>
        <time dateTime={match.playedAt} className="w-16 shrink-0 text-sm text-muted">
          {formatMatchDay(match.playedAt)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{match.opponent}</p>
          {scorers && <p className="truncate text-xs text-muted">{scorers}</p>}
        </div>
        <ResultMark result={result} />
        <p className="font-display w-18 shrink-0 text-right text-2xl leading-none">
          {match.ourScore}
          <span className="mx-1 text-muted">:</span>
          {match.theirScore}
        </p>
      </Link>
    </li>
  );
}

/** 우천 등으로 취소된 경기: 날짜·상대와 사유만, 흐리게 */
function CancelledRow({ match }: { match: Match }) {
  return (
    <li>
      <Link href={`/matches/${match.id}`} className={cn(rowStyles, "text-muted")}>
        <time dateTime={match.playedAt} className="w-16 shrink-0 text-sm">
          {formatMatchDay(match.playedAt)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium line-through decoration-muted/60">{match.opponent}</p>
          {match.cancelReason && <p className="truncate text-xs">{match.cancelReason}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">취소</span>
      </Link>
    </li>
  );
}

function UpcomingRow({ match }: { match: Match }) {
  const days = daysUntil(match.playedAt);
  // 킥오프 2시간 뒤(시간 미정이면 다음 날)부터 결과 입력 대기. 관리자 알림과 같은 기준.
  const overdue = isAwaitingResult(match);
  const closed = isVoteClosed(match);

  return (
    <li>
      <Link href={`/matches/${match.id}`} className={rowStyles}>
        <span className={cn("font-display w-16 shrink-0 text-lg leading-none", overdue ? "text-muted" : "text-amber")}>
          {formatDday(days)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{match.opponent}</p>
          <p className="flex gap-2 truncate text-xs text-muted">
            <time dateTime={match.kickoffTime ? `${match.playedAt}T${match.kickoffTime}` : match.playedAt}>
              {formatMatchDate(match.playedAt)}
              {match.kickoffTime && ` ${formatKickoffTime(match.kickoffTime)}`}
            </time>
            {match.location && <span className="truncate">{match.location}</span>}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            overdue || closed ? "bg-surface-2 text-muted" : "bg-pitch/10 text-pitch-ink",
          )}
        >
          {overdue ? "결과 입력 대기" : closed ? "투표 마감" : "참석 투표"}
        </span>
      </Link>
    </li>
  );
}

function groupByMonth(matches: Match[]) {
  const groups = new Map<string, { label: string; matches: Match[] }>();
  for (const match of matches) {
    const key = match.playedAt.slice(0, 7);
    const group = groups.get(key) ?? { label: formatMonth(match.playedAt), matches: [] };
    group.matches.push(match);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

export function MatchList() {
  const query = useMatches();

  if (query.isPending) return <ListSkeleton rows={5} />;

  if (query.isError) {
    return (
      <ErrorState
        message={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const { upcoming, finished } = splitMatches(query.data);
  const played = finished.filter((match) => isPlayed(match));

  if (upcoming.length === 0 && finished.length === 0) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="아직 기록한 경기가 없어요"
        description="지난 주말 경기부터 올려 보세요. 점수와 득점자를 적으면 시즌 전적이 자동으로 쌓여요."
        action={
          <AdminOnly fallback={<p className="text-sm text-muted">관리자가 경기를 등록하면 여기에 보여요.</p>}>
            <Link href="/matches/new" className={buttonStyles({ variant: "accent" })}>
              첫 경기 기록하기
            </Link>
          </AdminOnly>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {played.length > 0 && <SeasonBoard matches={played} />}

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="mb-1 text-sm font-medium text-muted">
            다가오는 경기
          </h2>
          <ul className="divide-y divide-line">
            {upcoming.map((match) => (
              <UpcomingRow key={match.id} match={match} />
            ))}
          </ul>
        </section>
      )}

      {groupByMonth(finished).map((group) => (
        <section key={group.key} aria-labelledby={`month-${group.key}`}>
          <h2 id={`month-${group.key}`} className="mb-1 text-sm font-medium text-muted">
            {group.label}
          </h2>
          <ul className="divide-y divide-line">
            {group.matches.map((match) =>
              match.cancelled ? <CancelledRow key={match.id} match={match} /> : <PlayedRow key={match.id} match={match} />,
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
