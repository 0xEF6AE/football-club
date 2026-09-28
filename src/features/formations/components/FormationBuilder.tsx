"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, CopyPlus, Eraser, Users, WandSparkles } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
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
  selectBench,
  toDraft,
} from "../lineup-reducer";
import { formatQuartersText } from "../lineup-text";
import { useFormations } from "../queries";
import { FORMATION_SHAPES, QUARTER_COUNT, quarterLabel, type SavedFormation } from "../schema";
import { getSlots } from "../templates";
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
 * 선수 목록(과 ?load= 로 지정된 저장 포메이션)을 불러온 뒤 빌더를 띄운다.
 * 선수가 없으면 등록 화면으로 안내.
 */
export function FormationPageContent() {
  const players = usePlayers();
  const formations = useFormations();
  const loadId = useSearchParams().get("load");

  if (players.isPending || (loadId && formations.isPending)) return <FormationSkeleton />;

  if (players.isError) {
    return (
      <ErrorState message={getErrorMessage(players.error)} onRetry={() => players.refetch()} retrying={players.isFetching} />
    );
  }

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
  const [importing, setImporting] = useState(false);

  // 작업 중 라인업을 이 기기에 남겨 두어 새로고침해도 사라지지 않게 한다.
  useEffect(() => {
    writeStorage(STORAGE_KEYS.lineupDraft, toDraft(state));
  }, [state]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const validPlayerIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);

  const active = activeLineup(state);
  const slots = getSlots(active.shape);
  const bench = selectBench(state, players);
  const attending = new Set(state.attendingIds);
  const filledCount = Object.values(active.assignments).filter(Boolean).length;
  const appearances = countAppearances(state.quarters);
  const upcoming = splitMatches(matches.data ?? []).upcoming;

  const selection = state.selection;
  const selectedSlot = selection?.kind === "slot" ? slots.find((s) => s.id === selection.slotId) : undefined;
  const selectedSlotPlayer = selectedSlot ? playersById.get(active.assignments[selectedSlot.id] ?? "") : undefined;
  const selectedBenchId = selection?.kind === "bench" ? selection.playerId : null;

  const lineupText = formatQuartersText({ quarters: state.quarters, attendingIds: state.attendingIds, playersById });

  /** 참석 선수를 적게 뛴 순으로 (같으면 등록 순). 벤치 시간을 고르게 나누는 데 참고한다. */
  const attendingPlayers = players
    .filter((p) => attending.has(p.id))
    .map((p) => ({ player: p, count: appearances.get(p.id) ?? 0 }))
    .sort((a, b) => a.count - b.count);

  /** 예정 경기의 참석 응답에서 "참석"인 선수만 참석자로 채운다. */
  const importAttendance = async (matchId: string) => {
    const match = upcoming.find((m) => m.id === matchId);
    if (!match) return;
    setImporting(true);
    try {
      const list = await queryClient.fetchQuery({
        queryKey: attendanceKeys.byMatch(matchId),
        queryFn: () => attendanceApi.list(matchId),
      });
      const ids = list.filter((a) => a.status === "yes").map((a) => a.playerId);
      dispatch({ type: "setAllAttending", playerIds: ids });
      setImportNote(`${formatMatchDate(match.playedAt)} ${match.opponent}전 참석 ${ids.length}명을 가져왔어요.`);
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
                  "focus-visible:ring-2 focus-visible:ring-pitch/40",
                  current ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                <span className="font-display text-base leading-tight tracking-wide">{index + 1}Q</span>
                <span className={cn("font-display text-[11px] leading-tight", filled === total ? "text-pitch" : "text-muted")}>
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
              <span className="text-muted"> / {players.length}명</span>
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
                disabled={attending.size === 0}
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
                onChange={(e) => void importAttendance(e.target.value)}
                disabled={importing}
                className="sm:max-w-sm"
              >
                <option value="">참석 투표에서 가져오기</option>
                {upcoming.map((match) => (
                  <option key={match.id} value={match.id}>
                    {formatMatchDate(match.playedAt)} {match.opponent}전
                  </option>
                ))}
              </Select>
              {importNote && (
                <p className="text-xs text-muted" role="status">
                  {importNote}
                </p>
              )}
            </div>
          )}

          <div role="group" aria-label="참석 선수" className="flex flex-wrap gap-2">
            {players.map((player) => (
              <Chip
                key={player.id}
                size="sm"
                pressed={attending.has(player.id)}
                onClick={() => dispatch({ type: "toggleAttending", playerId: player.id })}
              >
                {player.name}
                <span className="font-display text-xs opacity-70">{player.positions[0]}</span>
              </Chip>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              size="lg"
              onClick={() => dispatch({ type: "autoAssignAll", players })}
              disabled={attending.size === 0}
            >
              <WandSparkles className="size-4" aria-hidden />
              4쿼터 자동 배치
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => dispatch({ type: "autoAssign", players })}
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
            4쿼터 자동 배치는 앞 쿼터에서 쉰 선수를 다음 쿼터에 먼저 세워 출전 시간을 고르게 나눠요.
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
            <p className="text-sm text-muted">참석 선수 모두 자리가 있어요.</p>
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
                  <span className="font-display text-xs opacity-70">{player.positions.join(" ")}</span>
                </Chip>
              ))}
            </div>
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
                  <span
                    className={cn(
                      "font-display text-xs",
                      count === 0 ? "text-loss" : count < QUARTER_COUNT ? "text-muted" : "text-pitch",
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
