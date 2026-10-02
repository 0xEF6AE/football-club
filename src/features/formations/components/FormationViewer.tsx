"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState } from "@/components/ui/States";
import type { Player } from "@/features/players/schema";
import { getErrorMessage } from "@/lib/api-client";
import { useCopy } from "@/lib/use-copy";
import { cn, formatRelativeTime } from "@/lib/utils";
import { formatQuartersText } from "../lineup-text";
import { useFormations } from "../queries";
import { canPlayQuarter, displayName, guestAsPlayer, quarterLabel, summarizeShapes } from "../schema";
import { getSlots } from "../templates";
import { FormationSkeleton } from "./FormationBuilder";
import { Pitch } from "./Pitch";

type FormationViewerProps = {
  players: Player[];
  /** ?load= 로 지정된 포메이션. 없으면 가장 최근에 저장된 것 */
  loadId: string | null;
};

/**
 * 관리자가 아닌 모임원용 포메이션 화면. 저장된 라인업을 쿼터별로 보기만 한다.
 * 자리 바꾸기·자동 배치·저장은 관리자 화면(FormationBuilder)에만 있다.
 */
export function FormationViewer({ players, loadId }: FormationViewerProps) {
  const router = useRouter();
  const formations = useFormations();
  const [quarter, setQuarter] = useState(0);
  const { copied, copy } = useCopy();

  if (formations.isPending) return <FormationSkeleton />;
  if (formations.isError) {
    return (
      <ErrorState
        message={getErrorMessage(formations.error)}
        onRetry={() => formations.refetch()}
        retrying={formations.isFetching}
      />
    );
  }

  const list = formations.data;
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid />}
        title="아직 저장된 라인업이 없어요"
        description="관리자가 라인업을 짜서 저장하면 여기에서 쿼터별로 볼 수 있어요."
      />
    );
  }

  // 목록은 최근 수정순이라 첫 번째가 가장 최근 라인업이다.
  const formation = list.find((f) => f.id === loadId) ?? list[0];
  const lineup = formation.quarters[quarter] ?? formation.quarters[0];
  // 이 라인업의 용병까지 합친 명단 (용병은 선수 목록에 없다)
  const roster = [...players, ...formation.guests.map(guestAsPlayer)];
  const playersById = new Map(roster.map((p) => [p.id, p]));
  const attending = new Set(formation.attendingIds.filter((id) => playersById.has(id)));
  const assigned = new Set(Object.values(lineup.assignments));
  const shownQuarter = formation.quarters[quarter] ? quarter : 0;
  const bench = roster.filter(
    (p) => attending.has(p.id) && !assigned.has(p.id) && canPlayQuarter(formation.availability[p.id], shownQuarter),
  );
  const text = formatQuartersText({
    title: formation.name,
    quarters: formation.quarters,
    attendingIds: formation.attendingIds,
    playersById,
    availability: formation.availability,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <div className="flex flex-col gap-3 lg:sticky lg:top-18">
        <div role="tablist" aria-label="쿼터" className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2/60 p-1">
          {formation.quarters.map((q, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === quarter}
              aria-label={`${quarterLabel(index)} ${q.shape}`}
              onClick={() => setQuarter(index)}
              className={cn(
                "flex flex-col items-center rounded-md px-2 py-1.5 outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-pitch-ink/40",
                index === quarter ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              <span className="font-display text-base leading-tight tracking-wide">{index + 1}Q</span>
              <span className="font-display text-[11px] leading-tight">{q.shape}</span>
            </button>
          ))}
        </div>

        <Pitch readOnly slots={getSlots(lineup.shape)} assignments={lineup.assignments} playersById={playersById} selectedSlotId={null} />
      </div>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="viewer-heading" className="flex flex-col gap-2">
          <h2 id="viewer-heading" className="text-sm font-medium">
            라인업
          </h2>
          {list.length > 1 ? (
            <Select
              aria-label="라인업 고르기"
              value={formation.id}
              onChange={(nextId) => {
                setQuarter(0);
                router.replace(`/formation?load=${nextId}`, { scroll: false });
              }}
              options={list.map((f) => ({ value: f.id, label: f.name, hint: summarizeShapes(f.quarters.map((q) => q.shape)) }))}
              className="sm:max-w-sm"
            />
          ) : (
            <p className="font-medium">{formation.name}</p>
          )}
          <p className="text-xs text-muted">
            <span className="font-display tracking-wide">{summarizeShapes(formation.quarters.map((q) => q.shape))}</span>
            <span className="mx-1.5">|</span>
            참석 {attending.size}명
            <span className="mx-1.5">|</span>
            <time dateTime={formation.updatedAt}>{formatRelativeTime(formation.updatedAt)}</time> 저장
          </p>
        </section>

        <section aria-labelledby="viewer-bench-heading" className="flex flex-col gap-2">
          <h2 id="viewer-bench-heading" className="text-sm font-medium">
            {quarterLabel(quarter)} 벤치 <span className="font-display">{bench.length}</span>
          </h2>
          {bench.length === 0 ? (
            <p className="text-sm text-muted">참석 선수 모두 이 쿼터에 뛰어요.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {bench.map((player) => (
                <li key={player.id} className="rounded-md border border-line bg-surface px-2 py-1 text-sm">
                  {displayName(player)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="viewer-text-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="viewer-text-heading" className="text-sm font-medium">
              카톡용 텍스트 <span className="text-xs font-normal text-muted">1~4쿼터</span>
            </h2>
            <Button size="sm" variant="secondary" onClick={() => copy(text)}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "복사했어요" : "복사"}
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 font-sans text-sm leading-relaxed">
            {text}
          </pre>
        </section>

        <p className="border-t border-line pt-4 text-xs text-muted">
          라인업은 관리자만 짜고 고칠 수 있어요. 위 자물쇠로 관리자 모드를 켜면 편집 화면이 열려요.
        </p>
      </div>
    </div>
  );
}
