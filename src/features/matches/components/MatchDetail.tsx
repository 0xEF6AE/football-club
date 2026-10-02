"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/features/attendance/api";
import { attendanceKeys } from "@/features/attendance/queries";
import { feedbackApi } from "@/features/feedback/api";
import { feedbackKeys } from "@/features/feedback/queries";
import { formationsApi } from "@/features/formations/api";
import { formationKeys } from "@/features/formations/queries";
import { Check, ChevronLeft, Clock, Copy, MapPin, Pencil, Trash } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { AdminOnly } from "@/features/admin/components/AdminOnly";
import { AttendanceSection } from "@/features/attendance/components/AttendanceSection";
import { FeedbackSection } from "@/features/feedback/components/FeedbackSection";
import { Chip } from "@/components/ui/Chip";
import { Pitch } from "@/features/formations/components/Pitch";
import { useFormations } from "@/features/formations/queries";
import { quarterLabel, summarizeShapes } from "@/features/formations/schema";
import { getSlots } from "@/features/formations/templates";
import { usePlayers } from "@/features/players/queries";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { CLUB_NAME } from "@/lib/config";
import { useCopy } from "@/lib/use-copy";
import { cn, daysUntil, formatDateTime, formatDday, formatKickoffTime, formatMatchDate } from "@/lib/utils";
import { formatMatchText } from "../match-text";
import { useDeleteMatch, useMatch, useMatches } from "../queries";
import { buildHeadToHead, formatRecord } from "../stats";
import {
  getMatchResult,
  isPlayed,
  isVoteClosed,
  MATCH_RESULT_LABEL,
  type Match,
  type MatchFormationRef,
  type MatchResult,
  type PlayedScores,
} from "../schema";
import { MatchNotFound } from "./MatchEditor";

const RESULT_PILL: Record<MatchResult, string> = {
  win: "bg-amber text-amber-fg",
  draw: "bg-on-pitch/20 text-on-pitch",
  loss: "ring-1 ring-inset ring-on-pitch/40 text-on-pitch/80",
};

const panelStyles =
  "rounded-xl bg-pitch-deep px-5 py-6 text-on-pitch shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]";

function PanelMeta({ match }: { match: Match }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-on-pitch/75">
      <time dateTime={match.playedAt}>{formatMatchDate(match.playedAt, { withYear: true })}</time>
      {match.kickoffTime && (
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden />
          {formatKickoffTime(match.kickoffTime)}
        </span>
      )}
      {match.location && (
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden />
          {match.location}
        </span>
      )}
    </div>
  );
}

/**
 * 이 상대와의 역대 전적 한 줄. 전광판 맨 아래에 붙는다.
 * 결과가 있는 경기면 이 경기도 포함된 숫자라, 이 경기 하나뿐일 때는 말할 게 없어서 숨긴다.
 */
function HeadToHeadLine({ match }: { match: Match }) {
  const matches = useMatches();
  const record = useMemo(
    () => (matches.data ? buildHeadToHead(matches.data, match.opponent) : null),
    [matches.data, match.opponent],
  );
  if (!record) return null;
  if (isPlayed(match) && record.played <= 1) return null;

  return (
    <p className="mt-3 text-center text-sm text-on-pitch/75" aria-label="상대전적">
      {record.played === 0 ? (
        "이 팀과는 첫 경기예요."
      ) : (
        <>
          이 팀과 역대 <span className="font-display tracking-wide text-on-pitch">{formatRecord(record)}</span>
          <span className="mx-1.5 text-on-pitch/40">|</span>
          득 <span className="font-display text-on-pitch">{record.goalsFor}</span> 실{" "}
          <span className="font-display text-on-pitch">{record.goalsAgainst}</span>
        </>
      )}
    </p>
  );
}

function ScorePanel({ match }: { match: Match & PlayedScores }) {
  const result = getMatchResult(match);
  return (
    <section aria-label="경기 결과" className={panelStyles}>
      <PanelMeta match={match} />
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <p className="text-center text-sm font-medium leading-tight md:text-base">{CLUB_NAME}</p>
        <p className="font-display flex items-center gap-2 text-6xl leading-none md:text-7xl">
          <span className="text-amber">{match.ourScore}</span>
          <span className="text-3xl text-on-pitch/40">:</span>
          <span>{match.theirScore}</span>
        </p>
        <p className="text-center text-sm font-medium leading-tight md:text-base">{match.opponent}</p>
      </div>
      <p className="mt-4 flex justify-center">
        <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", RESULT_PILL[result])}>
          {MATCH_RESULT_LABEL[result]}
        </span>
      </p>
      <HeadToHeadLine match={match} />
    </section>
  );
}

function UpcomingPanel({ match }: { match: Match }) {
  const days = daysUntil(match.playedAt);
  const overdue = days < 0;
  const closed = isVoteClosed(match);
  return (
    <section aria-label="경기 예정" className={panelStyles}>
      <PanelMeta match={match} />
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <p className="text-center text-sm font-medium leading-tight md:text-base">{CLUB_NAME}</p>
        <p className={cn("font-display text-5xl leading-none md:text-6xl", overdue ? "text-on-pitch/60" : "text-amber")}>
          {formatDday(days)}
        </p>
        <p className="text-center text-sm font-medium leading-tight md:text-base">{match.opponent}</p>
      </div>
      <p className="mt-4 flex justify-center">
        <span className="rounded-full bg-on-pitch/15 px-3 py-1 text-sm font-medium">
          {overdue ? "결과 입력 대기" : closed ? "참석 투표 마감" : "참석 투표 진행 중"}
        </span>
      </p>
      {match.voteDeadline && !overdue && (
        <p className="mt-2 text-center text-xs text-on-pitch/70">
          투표 마감 <time dateTime={match.voteDeadline}>{formatDateTime(match.voteDeadline)}</time>
        </p>
      )}
      <HeadToHeadLine match={match} />
    </section>
  );
}

/** 경기에 붙여 둔 저장 포메이션. 쿼터를 골라 읽기 전용 피치로 보여 준다. */
function MatchFormationPanel({ formation }: { formation: MatchFormationRef }) {
  const players = usePlayers();
  const formations = useFormations();
  const [quarter, setQuarter] = useState(0);
  const saved = formations.data?.find((f) => f.id === formation.id);
  const playersById = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data]);
  const lineup = saved?.quarters[quarter];

  return (
    <section aria-labelledby="formation-heading">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="formation-heading" className="text-sm font-medium text-muted">
          포메이션
        </h2>
        <Link
          href={`/formation?load=${formation.id}`}
          className={buttonStyles({ variant: "ghost", size: "sm", className: "text-pitch-ink" })}
        >
          <AdminOnly fallback="라인업 크게 보기">빌더에서 열기</AdminOnly>
        </Link>
      </div>
      <p className="mb-3 font-medium">
        <span className="font-display mr-1.5 tracking-wide">{summarizeShapes(formation.shapes)}</span>
        {formation.name}
      </p>
      <div role="group" aria-label="쿼터" className="mb-3 flex flex-wrap gap-1.5">
        {formation.shapes.map((shape, index) => (
          <Chip
            key={index}
            size="sm"
            pressed={quarter === index}
            onClick={() => setQuarter(index)}
            aria-label={`${quarterLabel(index)} ${shape}`}
          >
            <span className="font-display tracking-wide">{index + 1}Q</span>
            <span className="font-display text-xs opacity-70">{shape}</span>
          </Chip>
        ))}
      </div>
      {lineup && players.data ? (
        <div className="mx-auto max-w-sm">
          <Pitch
            readOnly
            slots={getSlots(lineup.shape)}
            assignments={lineup.assignments}
            playersById={playersById}
            selectedSlotId={null}
          />
        </div>
      ) : (
        <Skeleton className="mx-auto w-full max-w-sm rounded-xl" style={{ aspectRatio: "68 / 105" }} />
      )}
    </section>
  );
}

/**
 * 아래 섹션(참석·댓글·피드백·포메이션)은 경기 정보가 온 뒤에야 그려지므로, 그대로 두면 요청이 두 단계로 줄을 선다.
 * 경기 정보와 동시에 미리 요청해 한 번의 대기로 끝나게 한다. 각 섹션의 훅은 같은 키라 캐시를 그대로 쓴다.
 */
function usePrefetchMatchSections(id: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery({ queryKey: attendanceKeys.byMatch(id), queryFn: () => attendanceApi.list(id) });
    void queryClient.prefetchQuery({ queryKey: attendanceKeys.comments(id), queryFn: () => attendanceApi.comments(id) });
    void queryClient.prefetchQuery({ queryKey: feedbackKeys.byMatch(id), queryFn: () => feedbackApi.list(id) });
    void queryClient.prefetchQuery({ queryKey: formationKeys.list(), queryFn: formationsApi.list });
  }, [id, queryClient]);
}

export function MatchDetail({ id }: { id: string }) {
  const router = useRouter();
  const query = useMatch(id);
  usePrefetchMatchSections(id);
  const remove = useDeleteMatch();
  const { copied, copy } = useCopy();
  const [confirming, setConfirming] = useState(false);

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <MatchNotFound />;
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const match = query.data;
  const played = isPlayed(match);

  return (
    <article className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/matches" className={buttonStyles({ variant: "ghost", size: "sm", className: "-ml-2 text-muted" })}>
          <ChevronLeft className="size-4" aria-hidden />
          경기 목록
        </Link>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copy(formatMatchText(match, CLUB_NAME, window.location.href))}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "복사했어요" : "카톡용 복사"}
          </Button>
          {/* 좁은 화면에서는 관리자 버튼을 아이콘만 남겨 한 줄에 들어가게 한다 */}
          <AdminOnly>
            <Link
              href={`/matches/${id}/edit`}
              aria-label={played ? "수정" : "결과 입력"}
              title={played ? "수정" : "결과 입력"}
              className={buttonStyles({ variant: "secondary", size: "sm", className: "w-9 px-0 sm:w-auto sm:px-3" })}
            >
              <Pencil className="size-4" aria-hidden />
              <span className="hidden sm:inline">{played ? "수정" : "결과 입력"}</span>
            </Link>
            <Button
              variant="danger"
              size="sm"
              aria-label="삭제"
              title="삭제"
              className="w-9 px-0 sm:w-auto sm:px-3"
              onClick={() => setConfirming(true)}
            >
              <Trash className="size-4" aria-hidden />
              <span className="hidden sm:inline">삭제</span>
            </Button>
          </AdminOnly>
        </div>
      </div>

      {isPlayed(match) ? <ScorePanel match={match} /> : <UpcomingPanel match={match} />}

      {match.goals.length > 0 && (
        <section aria-labelledby="goals-heading">
          <h2 id="goals-heading" className="mb-1 text-sm font-medium text-muted">
            득점
          </h2>
          <ol className="divide-y divide-line">
            {match.goals.map((goal, index) => (
              <li key={goal.id} className="flex items-baseline gap-3 py-2.5">
                <span className="font-display w-5 shrink-0 text-center text-sm text-muted">{index + 1}</span>
                <span className="font-medium">{goal.scorerName ?? "득점자 미상"}</span>
                {goal.assistName && <span className="text-sm text-muted">도움 {goal.assistName}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {match.memo && (
        <section aria-labelledby="memo-heading">
          <h2 id="memo-heading" className="mb-1 text-sm font-medium text-muted">
            메모
          </h2>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{match.memo}</p>
        </section>
      )}

      {match.formation && <MatchFormationPanel formation={match.formation} />}

      <AttendanceSection match={match} />

      {played && <FeedbackSection matchId={id} match={match} />}

      <ConfirmDialog
        open={confirming}
        title="이 경기를 삭제할까요?"
        description="득점 기록, 참석 응답, 피드백도 함께 지워져요. 되돌릴 수 없어요."
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onConfirm={() => remove.mutate(id, { onSuccess: () => router.replace("/matches") })}
        onCancel={() => {
          if (!remove.isPending) setConfirming(false);
        }}
      />
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="불러오는 중">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-24" />
    </div>
  );
}
