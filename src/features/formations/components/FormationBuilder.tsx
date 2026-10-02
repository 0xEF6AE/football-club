"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, CopyPlus, Eraser, Users, WandSparkles } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { attendanceApi } from "@/features/attendance/api";
import { attendanceKeys } from "@/features/attendance/queries";
import { useMatches } from "@/features/matches/queries";
import { splitMatches } from "@/features/matches/schema";
import { usePlayers } from "@/features/players/queries";
import type { Player } from "@/features/players/schema";
import { getErrorMessage } from "@/lib/api-client";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { useCopy } from "@/lib/use-copy";
import { cn, formatMatchDate } from "@/lib/utils";
import {
  activeLineup,
  countAppearances,
  createInitialLineup,
  lineupReducer,
  restoreLineup,
  rosterOf,
  selectBench,
  selectUnavailable,
  toDraft,
} from "../lineup-reducer";
import { formatQuartersText } from "../lineup-text";
import { useFormations } from "../queries";
import {
  FORMATION_SHAPES,
  formatQuarters,
  isGuestId,
  QUARTER_COUNT,
  quarterLabel,
  type PlayerAvailability,
  type SavedFormation,
} from "../schema";
import { getSlots } from "../templates";
import { FormationViewer } from "./FormationViewer";
import { Pitch } from "./Pitch";
import { SavedFormations } from "./SavedFormations";

export function FormationSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "68 / 105" }} />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

/**
 * 관리자면 빌더(자리 바꾸기·자동 배치·저장), 아니면 저장된 라인업을 보기만 하는 화면을 띄운다.
 * 선수가 없으면 등록 화면으로 안내.
 */
export function FormationPageContent() {
  const players = usePlayers();
  const formations = useFormations();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const loadId = useSearchParams().get("load");

  if (players.isPending || adminLoading || (loadId && formations.isPending)) return <FormationSkeleton />;

  if (players.isError) {
    return (
      <ErrorState message={getErrorMessage(players.error)} onRetry={() => players.refetch()} retrying={players.isFetching} />
    );
  }

  if (!isAdmin) return <FormationViewer players={players.data} loadId={loadId} />;

  if (players.data.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="선수를 먼저 등록해 주세요"
        description="각 선수가 뛸 수 있는 포지션을 넣어 두면 참석자만 골라서 쿼터별로 자동 배치해 드려요."
        action={
          <Link href="/players" className={buttonStyles({ variant: "accent" })}>
            선수 등록하러 가기
          </Link>
        }
      />
    );
  }

  const initialFormation = loadId ? formations.data?.find((f) => f.id === loadId) ?? null : null;

  // 다른 포메이션을 열러 오면(다른 load id) 빌더를 새로 만든다.
  return <FormationBuilder key={loadId ?? "draft"} players={players.data} initialFormation={initialFormation} />;
}

type FormationBuilderProps = {
  players: Player[];
  /** ?load= 로 열린 저장 포메이션. 있으면 임시 저장본보다 우선한다. */
  initialFormation?: SavedFormation | null;
};

export function FormationBuilder({ players, initialFormation = null }: FormationBuilderProps) {
  const [state, dispatch] = useReducer(lineupReducer, players, (list) => {
    const fresh = createInitialLineup(list);
    if (initialFormation) {
      return lineupReducer(fresh, {
        type: "load",
        formation: initialFormation,
        validPlayerIds: new Set(list.map((p) => p.id)),
      });
    }
    return restoreLineup(list, readStorage(STORAGE_KEYS.lineupDraft)) ?? fresh;
  });
  const queryClient = useQueryClient();
  const matches = useMatches();
  const { copied, copy } = useCopy();
  const [importNote, setImportNote] = useState<string | null>(null);
  /** 마지막으로 가져온 경기의 투표 상태 (보류·불참·미투표·마감 후). 주장이 누구를 더 넣을지 보는 용도 */
  const [voteTags, setVoteTags] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  // 작업 중 라인업을 이 기기에 남겨 두어 새로고침해도 사라지지 않게 한다.
  useEffect(() => {
    writeStorage(STORAGE_KEYS.lineupDraft, toDraft(state));
  }, [state]);

  // 선수 + 이 라인업의 용병. 자동 배치·이름 찾기·벤치 모두 이 명단으로 한다.
  const roster = useMemo(() => rosterOf({ guests: state.guests }, players), [state.guests, players]);
  const playersById = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const validPlayerIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);
  const availabilityTag = (id: string) => formatQuarters(state.availability[id]);

  const active = activeLineup(state);
  const slots = getSlots(active.shape);
  const bench = selectBench(state, roster);
  const unavailable = selectUnavailable(state, roster);
  const attending = new Set(state.attendingIds);
  const filledCount = Object.values(active.assignments).filter(Boolean).length;
  const appearances = countAppearances(state.quarters);
  const upcoming = splitMatches(matches.data ?? []).upcoming;

  const selection = state.selection;
  const selectedSlot = selection?.kind === "slot" ? slots.find((s) => s.id === selection.slotId) : undefined;
  const selectedSlotPlayer = selectedSlot ? playersById.get(active.assignments[selectedSlot.id] ?? "") : undefined;
  const selectedBenchId = selection?.kind === "bench" ? selection.playerId : null;

  const lineupText = formatQuartersText({
    quarters: state.quarters,
    attendingIds: state.attendingIds,
    playersById,
    availability: state.availability,
  });

  /** 참석 선수를 적게 뛴 순으로 (같으면 등록 순). 벤치 시간을 고르게 나누는 데 참고한다. */
  const attendingPlayers = roster
    .filter((p) => attending.has(p.id))
    .map((p) => ({ player: p, count: appearances.get(p.id) ?? 0 }))
    .sort((a, b) => a.count - b.count);

  /**
   * 예정 경기의 참석 투표에서 가져온다: "참석"인 선수(마감 후 참석 포함), 각자 뛸 수 있는 쿼터, 그 경기의 용병.
   * 자동 배치는 이 쿼터 정보를 따른다.
   */
  const importAttendance = async (matchId: string) => {
    const match = upcoming.find((m) => m.id === matchId);
    if (!match) return;
    setImporting(true);
    try {
      const [list, guests] = await Promise.all([
        queryClient.fetchQuery({ queryKey: attendanceKeys.byMatch(matchId), queryFn: () => attendanceApi.list(matchId) }),
        queryClient.fetchQuery({ queryKey: attendanceKeys.guests(matchId), queryFn: () => attendanceApi.guests(matchId) }),
      ]);
      const yes = list.filter((a) => a.status === "yes" && validPlayerIds.has(a.playerId));
      const rowOf = new Map(list.map((a) => [a.playerId, a]));
      const tags: Record<string, string> = {};
      for (const player of players) {
        const row = rowOf.get(player.id);
        const tag = !row ? "미투표" : row.status === "no" ? "불참" : row.status === "maybe" ? "보류" : row.lateJoin ? "마감 후" : "";
        if (tag) tags[player.id] = tag;
      }
      setVoteTags(tags);
      const lateCount = yes.filter((a) => a.lateJoin).length;
      const availability: PlayerAvailability = {};
      for (const row of yes) if (row.quarters) availability[row.playerId] = row.quarters;
      for (const guest of guests) if (guest.quarters) availability[guest.id] = guest.quarters;
      dispatch({
        type: "importMatch",
        playerIds: yes.map((a) => a.playerId),
        availability,
        guests: guests.map(({ id, name, positions }) => ({ id, name, positions })),
      });
      const limited = Object.keys(availability).length;
      setImportNote(
        `${formatMatchDate(match.playedAt)} ${match.opponent}전 참석 ${yes.length}명` +
          (lateCount > 0 ? `(마감 후 ${lateCount}명 포함)` : "") +
          (guests.length > 0 ? `, 용병 ${guests.length}명` : "") +
          "을 가져왔어요." +
          (limited > 0 ? ` 늦참·조퇴 ${limited}명은 뛸 수 있는 쿼터에만 배치해요.` : ""),
      );
    } catch (error) {
      setImportNote(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <div className="flex flex-col gap-3 lg:sticky lg:top-18">
        <div role="tablist" aria-label="쿼터" className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2/60 p-1">
          {state.quarters.map((quarter, index) => {
            const filled = Object.values(quarter.assignments).filter(Boolean).length;
            const total = getSlots(quarter.shape).length;
            const current = index === state.activeQuarter;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={current}
                aria-label={`${quarterLabel(index)} ${quarter.shape} ${filled}/${total} 자리 채움`}
                onClick={() => dispatch({ type: "setQuarter", index })}
                className={cn(
                  "flex flex-col items-center rounded-md px-2 py-1.5 outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-pitch-ink/40",
                  current ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                <span className="font-display text-base leading-tight tracking-wide">{index + 1}Q</span>
                <span className={cn("font-display text-[11px] leading-tight", filled === total ? "text-pitch-ink" : "text-muted")}>
                  {filled}/{total}
                </span>
              </button>
            );
          })}
        </div>

        <div role="group" aria-label={`${quarterLabel(state.activeQuarter)} 포메이션 모양`} className="flex flex-wrap gap-2">
          {FORMATION_SHAPES.map((shape) => (
            <Chip
              key={shape}
              size="sm"
              pressed={active.shape === shape}
              onClick={() => dispatch({ type: "setShape", shape })}
              className="font-display tracking-wider"
            >
              {shape}
            </Chip>
          ))}
        </div>

        <Pitch
          slots={slots}
          assignments={active.assignments}
          playersById={playersById}
          selectedSlotId={selectedSlot?.id ?? null}
          onTapSlot={(slotId) => dispatch({ type: "tapSlot", slotId })}
        />

        <div
          className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2 text-sm"
          aria-live="polite"
        >
          {selectedSlot ? (
            <>
              <p>
                <span className="font-display tracking-wide">{selectedSlot.position}</span>{" "}
                {selectedSlotPlayer ? (
                  <>
                    <b className="font-semibold">{selectedSlotPlayer.name}</b> 선택. 다른 자리를 누르면 서로 바꿔요.
                  </>
                ) : (
                  "빈 자리. 벤치 선수를 누르면 여기에 배치돼요."
                )}
              </p>
              <div className="flex shrink-0 gap-1">
                {selectedSlotPlayer && (
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "clearSlot", slotId: selectedSlot.id })}>
                    벤치로
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "clearSelection" })}>
                  취소
                </Button>
              </div>
            </>
          ) : selectedBenchId ? (
            <>
              <p>
                <b className="font-semibold">{playersById.get(selectedBenchId)?.name}</b> 선택. 배치할 자리를 누르세요.
              </p>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "clearSelection" })}>
                취소
              </Button>
            </>
          ) : (
            <p className="text-muted">
              <span className="font-medium text-fg">{quarterLabel(state.activeQuarter)}</span>{" "}
              <span className="font-display text-fg">
                {filledCount}/{slots.length}
              </span>{" "}
              자리 채움. 자리나 벤치 선수를 눌러 바꿀 수 있어요.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="attending-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="attending-heading" className="text-sm font-medium">
              참석 <span className="font-display">{attending.size}</span>
              <span className="text-muted">
                {" "}
                / {players.length}명{state.guests.length > 0 && ` + 용병 ${state.guests.length}명`}
              </span>
            </h2>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: "setAllAttending", playerIds: players.map((p) => p.id) })}
                disabled={attending.size === players.length}
              >
                전체 선택
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: "setAllAttending", playerIds: [] })}
                disabled={attending.size === state.guests.filter((g) => attending.has(g.id)).length}
              >
                전체 해제
              </Button>
            </div>
          </div>

          {upcoming.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Select
                aria-label="참석 투표에서 가져오기"
                value=""
                placeholder="참석 투표에서 가져오기"
                onChange={(matchId) => void importAttendance(matchId)}
                disabled={importing}
                options={upcoming.map((match) => ({
                  value: match.id,
                  label: `${match.opponent}전`,
                  hint: formatMatchDate(match.playedAt),
                }))}
                className="sm:max-w-sm"
              />
              {importNote && (
                <p className="text-xs text-muted" role="status">
                  {importNote} 보류·불참·미투표인데 온 사람은 이름을 눌러 넣으면 돼요.
                </p>
              )}
            </div>
          )}

          <div role="group" aria-label="참석 선수" className="flex flex-wrap gap-2">
            {roster.map((player) => (
              <Chip
                key={player.id}
                size="sm"
                pressed={attending.has(player.id)}
                onClick={() => dispatch({ type: "toggleAttending", playerId: player.id })}
                className={cn(isGuestId(player.id) && "border-dashed")}
              >
                {player.name}
                {isGuestId(player.id) && <span className="text-xs opacity-80">용병</span>}
                <span className="font-display text-xs opacity-70">{player.positions[0]}</span>
                {availabilityTag(player.id) && <span className="text-xs opacity-80">{availabilityTag(player.id)}</span>}
                {voteTags[player.id] && <span className="text-xs opacity-80">{voteTags[player.id]}</span>}
              </Chip>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              size="lg"
              onClick={() => dispatch({ type: "autoAssignAll", players: roster })}
              disabled={attending.size === 0}
            >
              <WandSparkles className="size-4" aria-hidden />
              4쿼터 자동 배치
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => dispatch({ type: "autoAssign", players: roster })}
              disabled={attending.size === 0}
            >
              {quarterLabel(state.activeQuarter)}만 배치
            </Button>
            <Button variant="ghost" size="lg" onClick={() => dispatch({ type: "clearAll" })} disabled={filledCount === 0}>
              <Eraser className="size-4" aria-hidden />
              비우기
            </Button>
          </div>
          <p className="text-xs text-muted">
            4쿼터 자동 배치는 덜 뛴 사람부터 세워 출전 시간을 고르게 나누고, 골키퍼는 GK가 되는 사람끼리 돌아가며 맡겨요.
            늦참·조퇴는 뛸 수 있는 쿼터에만 세워요.
          </p>
          {state.activeQuarter > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="self-start text-muted"
              onClick={() => dispatch({ type: "copyQuarter", from: state.activeQuarter - 1 })}
            >
              <CopyPlus className="size-4" aria-hidden />
              {quarterLabel(state.activeQuarter - 1)} 배치를 {quarterLabel(state.activeQuarter)}로 복사
            </Button>
          )}
        </div>

        <section aria-labelledby="bench-heading" className="flex flex-col gap-3">
          <h2 id="bench-heading" className="text-sm font-medium">
            {quarterLabel(state.activeQuarter)} 벤치 <span className="font-display">{bench.length}</span>
          </h2>
          {attending.size === 0 ? (
            <p className="text-sm text-muted">참석 선수를 먼저 골라 주세요.</p>
          ) : bench.length === 0 ? (
            <p className="text-sm text-muted">이 쿼터에 뛸 수 있는 사람은 모두 자리가 있어요.</p>
          ) : (
            <div role="group" aria-label="벤치 선수" className="flex flex-wrap gap-2">
              {bench.map((player) => (
                <Chip
                  key={player.id}
                  size="sm"
                  tone="amber"
                  pressed={selectedBenchId === player.id}
                  onClick={() => dispatch({ type: "tapBench", playerId: player.id })}
                >
                  {player.name}
                  {isGuestId(player.id) && <span className="text-xs opacity-80">용병</span>}
                  <span className="font-display text-xs opacity-70">{player.positions.join(" ")}</span>
                </Chip>
              ))}
            </div>
          )}
          {unavailable.length > 0 && (
            <p className="text-xs text-muted">
              이 쿼터에 못 뛰는 사람:{" "}
              {unavailable.map((p) => `${p.name}(${availabilityTag(p.id)})`).join(", ")}
            </p>
          )}
        </section>

        {attending.size > 0 && (
          <section aria-labelledby="appearances-heading" className="flex flex-col gap-2">
            <h2 id="appearances-heading" className="text-sm font-medium">
              쿼터별 출전 <span className="text-xs font-normal text-muted">적게 뛴 순</span>
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {attendingPlayers.map(({ player, count }) => (
                <li
                  key={player.id}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-sm"
                >
                  {player.name}
                  {availabilityTag(player.id) && <span className="text-xs text-muted">{availabilityTag(player.id)}</span>}
                  <span
                    className={cn(
                      "font-display text-xs",
                      count === 0 ? "text-loss" : count < QUARTER_COUNT ? "text-muted" : "text-pitch-ink",
                    )}
                  >
                    {count}/{QUARTER_COUNT}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="text-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="text-heading" className="text-sm font-medium">
              카톡용 텍스트 <span className="text-xs font-normal text-muted">1~4쿼터</span>
            </h2>
            <Button size="sm" variant="secondary" onClick={() => copy(lineupText)}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "복사했어요" : "복사"}
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 font-sans text-sm leading-relaxed">
            {lineupText}
          </pre>
        </section>

        <SavedFormations state={state} dispatch={dispatch} validPlayerIds={validPlayerIds} />
      </div>
    </div>
  );
}
