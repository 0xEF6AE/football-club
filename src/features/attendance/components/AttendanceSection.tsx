"use client";

import { useEffect, useId, useReducer, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, KeyRound, Vote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, InlineError } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { formatQuarters } from "@/features/formations/schema";
import {
  canJoinLate,
  effectiveVoteDeadline,
  isPlayed,
  isVoteClosed,
  lateJoinCloseAt,
  resultDueAt,
  type Match,
} from "@/features/matches/schema";
import { formatVoteDeadline } from "@/features/matches/match-text";
import { PlayerPicker } from "@/features/players/components/PlayerPicker";
import { playerKeys, usePlayers } from "@/features/players/queries";
import { getErrorMessage } from "@/lib/api-client";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { cn, formatDateTime } from "@/lib/utils";
import { isPinRejection, isValidPin, readPins, writePins } from "../pin";
import { useAttendance, useGuests, useRemoveAttendance, useSetAttendance } from "../queries";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, ATTENDANCE_TONE, type Attendance, type AttendanceStatus } from "../schema";
import { CommentThread, type PinCredential } from "./CommentThread";
import { GuestSection } from "./GuestSection";
import { QuarterPicker } from "./QuarterPicker";
import { SecondCallPanel } from "./SecondCallPanel";

function readMe(): string {
  const stored = readStorage(STORAGE_KEYS.me);
  return typeof stored === "string" ? stored : "";
}

/** 마감·늦은 참석 마감처럼 상태가 바뀌는 시각이 되면 화면이 스스로 다시 그려지게 한다. */
function useTickAt(times: number[]) {
  const [ticks, tick] = useReducer((n: number) => n + 1, 0);
  const key = times.join(",");
  useEffect(() => {
    // 다시 그려진 뒤(ticks가 바뀐 뒤)에는 그다음 시각을 기다린다.
    const now = Date.now();
    const next = key
      .split(",")
      .map(Number)
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(tick, Math.min(next - now + 50, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [key, ticks]);
}

/** 명단의 이름 하나: 늦참·조퇴 쿼터와 "마감 후" 표시를 붙인다 */
function NameTag({ name, row }: { name: string; row: Attendance }) {
  const quarters = row.status === "yes" ? formatQuarters(row.quarters) : "";
  return (
    <li className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-sm">
      {name}
      {quarters && <span className="text-xs text-muted">{quarters}</span>}
      {row.lateJoin && (
        <span className="rounded-sm bg-amber/20 px-1 text-[11px] font-medium" title="투표 마감 뒤에 참석으로 바꿨어요">
          마감 후
        </span>
      )}
    </li>
  );
}

/**
 * 경기별 참석 투표. 이름을 고르고 참석/불참/보류를 누른다 (로그인 없음).
 * 그 이름으로 행동하려면 선수 개인 PIN(숫자 4자리)이 맞아야 한다. 처음이면 그때 입력한 PIN으로 정해진다.
 * - 마감: 따로 정한 시각, 없으면 킥오프 시각(킥오프 미정이면 경기 당일 0시). 판정은 matches/schema의 isVoteClosed.
 * - 마감 뒤 ~ 킥오프 2시간 뒤에는 "늦게라도 참석"만 받는다. 그렇게 온 사람은 "마감 후"로 표시된다.
 * - 참석이면 뛸 수 있는 쿼터(늦참·조퇴)를 고를 수 있고, 포메이션 자동 배치가 이를 따른다.
 * - 비밀번호가 걸린 배포의 관리자는 언제든 명단을 고친다(현장에서 온 사람 추가 등). 용병도 관리자가 넣는다.
 */
export function AttendanceSection({ match }: { match: Match }) {
  const matchId = match.id;
  const played = isPlayed(match);
  const id = useId();
  const queryClient = useQueryClient();
  const players = usePlayers();
  const attendance = useAttendance(matchId);
  const guests = useGuests(matchId);
  const set = useSetAttendance(matchId);
  const remove = useRemoveAttendance(matchId);
  const { isAdmin, isProtected } = useAdmin();
  // 이 컴포넌트는 데이터를 받은 뒤 브라우저에서만 그려지므로 초기값을 localStorage에서 바로 읽어도 안전하다.
  const [me, setMe] = useState(readMe);
  const [savedPins, setSavedPins] = useState(readPins);
  const [pinDraft, setPinDraft] = useState("");
  const deadline = effectiveVoteDeadline(match);
  const lateCloseAt = lateJoinCloseAt(match);
  useTickAt([new Date(deadline).getTime(), lateCloseAt, resultDueAt(match)]);

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
  const guestList = guests.data ?? [];
  const nameOf = new Map(list.map((p) => [p.id, p.name]));
  const rowOf = new Map(attendance.data.map((a) => [a.playerId, a]));
  const statusOf = new Map(attendance.data.map((a) => [a.playerId, a.status]));
  const myRow = me ? rowOf.get(me) : undefined;
  const myStatus = myRow?.status;
  const rowsBy = (status: AttendanceStatus) =>
    attendance.data.filter((a) => a.status === status && nameOf.has(a.playerId));
  const noResponse = list.filter((p) => !statusOf.has(p.id)).map((p) => p.name);
  const mutationError = set.isError ? set.error : remove.isError ? remove.error : null;

  const closed = isVoteClosed(match);
  const lateWindow = canJoinLate(match);
  // 서버(attendance route)와 같은 규칙: 비밀번호가 걸린 배포에서만 관리자가 마감 뒤에도 고칠 수 있다.
  const adminOverride = closed && isAdmin && isProtected;
  const canEditFully = !closed || adminOverride;
  const canJoinNow = canEditFully || lateWindow;
  const showForm = !match.cancelled || adminOverride;

  const chooseMe = (playerId: string) => {
    setMe(playerId);
    setPinDraft("");
    writeStorage(STORAGE_KEYS.me, playerId);
  };

  // ── 본인 확인(PIN) ──
  const mePlayer = list.find((p) => p.id === me);
  // 비밀번호가 걸린 배포의 관리자는 서버가 PIN 없이 통과시킨다 (주장이 대신 체크).
  const pinBypass = isAdmin && isProtected;
  const savedPin = me ? savedPins[me] : undefined;
  const pin = savedPin ?? pinDraft;
  const pinReady = pinBypass || isValidPin(pin);

  const updatePins = (next: Record<string, string>) => {
    setSavedPins(next);
    writePins(next);
  };
  const forgetPin = () => {
    if (!me) return;
    const rest = { ...savedPins };
    delete rest[me];
    updatePins(rest);
    setPinDraft("");
  };
  const credential: PinCredential = {
    pin: pinBypass ? undefined : pin,
    ready: pinReady,
    /** 서버가 받아 준 PIN은 이 기기에 기억한다. 처음 정한 경우 hasPin이 바뀌므로 선수 목록도 새로 받는다. */
    accept: () => {
      if (pinBypass || !me) return;
      if (savedPins[me] !== pin) updatePins({ ...savedPins, [me]: pin });
      setPinDraft("");
      if (mePlayer && !mePlayer.hasPin) void queryClient.invalidateQueries({ queryKey: playerKeys.all });
    },
    /** 틀린 PIN이면 기억한 값을 지워 다시 묻게 한다. 그 사이 누가 PIN을 정했을 수도 있으니 선수 목록도 새로. */
    reject: (error) => {
      if (!isPinRejection(error)) return;
      forgetPin();
      void queryClient.invalidateQueries({ queryKey: playerKeys.all });
    },
  };
  const withPin = { onSuccess: credential.accept, onError: credential.reject };
  const busy = set.isPending || remove.isPending;
  const vote = (status: AttendanceStatus, quarters: number[] | null = status === "yes" ? (myRow?.quarters ?? null) : null) =>
    set.mutate({ matchId, input: { playerId: me, status, quarters, pin: credential.pin } }, withPin);

  // 마감 안내 문구 (언제까지 받는지). 킥오프와 헷갈리지 않게 경기 상세·카톡 글과 같은 표기.
  const deadlineText = formatVoteDeadline(match);

  const note = !me
    ? "이름을 고르면 참석 여부를 누를 수 있어요."
    : !pinReady
      ? mePlayer?.hasPin
        ? "내 PIN 4자리를 넣으면 누를 수 있어요."
        : "처음이면 PIN 4자리를 정해 주세요. 다른 사람이 내 이름으로 누르지 못하게 막아요."
      : adminOverride
        ? "마감됐지만 관리자는 명단을 고칠 수 있어요. 마감 뒤에 참석으로 바꾸면 '마감 후'로 표시돼요."
        : lateWindow
          ? myStatus === "yes"
            ? "마감됐어요. 늦거나 일찍 가면 뛸 수 있는 쿼터만 바꿀 수 있어요."
            : `마감됐지만 그래도 올 수 있으면 ${formatDateTime(new Date(lateCloseAt).toISOString())}까지 '늦게라도 참석'을 눌러 주세요.`
          : closed
            ? "투표가 마감돼 응답을 바꿀 수 없어요. 사정이 생겼으면 아래 댓글로 알려 주세요."
            : "응답은 모임원 모두에게 보이고, 마감 전까지 바꿀 수 있어요.";

  const yesRows = rowsBy("yes");

  return (
    <section aria-labelledby="attendance-heading" className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="attendance-heading" className="text-lg font-semibold">
          {played ? "참석 명단" : "참석 투표"}{" "}
          <span className="font-display text-base font-normal text-muted">{yesRows.length + guestList.length}</span>
        </h2>
        <p className="text-xs text-muted">
          전체 {list.length}명{guestList.length > 0 && ` + 용병 ${guestList.length}명`}
        </p>
      </div>

      {match.cancelled ? (
        <p className="flex items-center gap-1.5 text-sm text-muted" role="status">
          <Ban className="size-4 shrink-0" aria-hidden />
          취소된 경기예요{match.cancelReason && ` (${match.cancelReason})`}. 투표를 받지 않아요.
        </p>
      ) : (
        !played && (
          <p className={cn("flex items-center gap-1.5 text-sm", closed ? "text-muted" : "text-fg")} role="status">
            <Vote className="size-4 shrink-0" aria-hidden />
            {/* flex 간격이 "시각"과 "에" 사이를 벌리지 않도록 문장을 한 덩어리로 감싼다 */}
            {closed ? (
              <span>
                투표는 <time dateTime={deadline}>{deadlineText}</time>에 마감됐어요
                {lateWindow && ` · 추가 참석은 ${formatDateTime(new Date(lateCloseAt).toISOString())}까지 받아요`}
              </span>
            ) : (
              <span>
                투표는 <time dateTime={deadline}>{deadlineText}</time>까지 받아요
              </span>
            )}
          </p>
        )
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">선수가 등록되면 참석 여부를 받을 수 있어요.</p>
      ) : (
        showForm &&
        (!played || adminOverride) && (
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PlayerPicker
                label="내 이름"
                placeholder="내 이름 검색 (초성도 돼요)"
                players={list}
                value={me}
                onChange={chooseMe}
                describe={(player) => {
                  const status = statusOf.get(player.id);
                  return status ? ATTENDANCE_LABEL[status] : "응답 전";
                }}
                className="min-w-48 flex-1"
              />
              <div role="group" aria-label="참석 여부" className="flex gap-1.5">
                {canEditFully ? (
                  ATTENDANCE_STATUSES.map((status) => (
                    <Chip
                      key={status}
                      size="sm"
                      tone={ATTENDANCE_TONE[status]}
                      pressed={myStatus === status}
                      disabled={!me || !pinReady || busy}
                      onClick={() => vote(status)}
                    >
                      {ATTENDANCE_LABEL[status]}
                    </Chip>
                  ))
                ) : myStatus === "yes" ? (
                  <Chip size="sm" pressed disabled>
                    참석
                  </Chip>
                ) : (
                  <Chip size="sm" disabled={!me || !pinReady || busy || !canJoinNow} onClick={() => vote("yes", null)}>
                    늦게라도 참석
                  </Chip>
                )}
              </div>
            </div>

            {me && myStatus === "yes" && canJoinNow && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">뛸 수 있는 쿼터</span>
                <QuarterPicker value={myRow?.quarters ?? null} onChange={(quarters) => vote("yes", quarters)} disabled={!pinReady || busy} />
                <span className="text-xs text-muted">늦거나 일찍 가면 못 뛰는 쿼터를 꺼 주세요.</span>
              </div>
            )}

            {me && !pinBypass && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <KeyRound className="size-4 shrink-0 text-muted" aria-hidden />
                {savedPin ? (
                  <>
                    <span className="text-muted">이 기기에 {mePlayer?.name ?? ""} PIN이 기억돼 있어요.</span>
                    <Button size="sm" variant="ghost" className="text-muted" onClick={forgetPin}>
                      다른 PIN 넣기
                    </Button>
                  </>
                ) : (
                  <>
                    <label htmlFor={`${id}-pin`} className="font-medium">
                      {mePlayer?.hasPin ? "내 PIN" : "PIN 정하기"}
                    </label>
                    <Input
                      id={`${id}-pin`}
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="숫자 4자리"
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="font-display w-32 bg-surface text-center tracking-[0.4em]"
                    />
                    {mePlayer?.hasPin && (
                      <span className="text-xs text-muted">잊었으면 관리자에게 초기화를 부탁하세요.</span>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">{note}</p>
              {myStatus && canEditFully && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted"
                  onClick={() => remove.mutate({ matchId, playerId: me, pin: credential.pin }, withPin)}
                  disabled={!pinReady}
                  pending={remove.isPending}
                >
                  응답 지우기
                </Button>
              )}
            </div>
            <InlineError>{mutationError ? getErrorMessage(mutationError) : null}</InlineError>
          </form>
        )
      )}

      {attendance.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {ATTENDANCE_STATUSES.map((status) => {
            const rows = rowsBy(status);
            return (
              <div key={status}>
                <p className="mb-1.5 text-xs font-medium text-muted">
                  {ATTENDANCE_LABEL[status]} <span className="font-display">{rows.length}</span>
                </p>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted/70">없음</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {rows.map((row) => (
                      <NameTag key={row.playerId} name={nameOf.get(row.playerId)!} row={row} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <GuestSection matchId={matchId} guests={guestList} canEdit={isAdmin && !match.cancelled} />

      {/* 주장: 투표가 마감된 뒤 보류·불참·미투표에게 다시 묻기 */}
      {isAdmin && closed && !played && !match.cancelled && (
        <SecondCallPanel
          match={match}
          maybe={rowsBy("maybe").map((r) => nameOf.get(r.playerId)!)}
          no={rowsBy("no").map((r) => nameOf.get(r.playerId)!)}
          none={noResponse}
          attending={yesRows.length}
          guests={guestList.length}
        />
      )}

      {noResponse.length > 0 && attendance.data.length > 0 && !played && !match.cancelled && (
        <p className="text-xs leading-relaxed text-muted">
          아직 응답 없음 {noResponse.length}명: {noResponse.join(", ")}
        </p>
      )}

      {list.length > 0 && (
        <CommentThread
          matchId={matchId}
          me={me}
          myName={nameOf.get(me) ?? null}
          statusOf={statusOf}
          credential={credential}
        />
      )}
    </section>
  );
}
