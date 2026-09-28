import { cn } from "@/lib/utils";
import { getMatchResult, isPlayed, MATCH_RESULT_LABEL, summarizeRecord, type Match, type MatchResult } from "../schema";

const RESULT_TONE: Record<MatchResult, string> = {
  win: "bg-amber text-amber-fg",
  draw: "bg-on-pitch/25 text-on-pitch",
  loss: "bg-pitch-line/10 text-on-pitch/60 ring-1 ring-inset ring-on-pitch/30",
};

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dd className={cn("font-display text-3xl leading-none md:text-4xl", accent ? "text-amber" : "text-on-pitch")}>
        {value}
      </dd>
      <dt className="text-[11px] text-on-pitch/65">{label}</dt>
    </div>
  );
}

/** 전광판: 시즌 전적과 최근 5경기 흐름. matches는 최신순이어야 하고, 예정 경기는 무시한다. */
export function SeasonBoard({ matches }: { matches: Match[] }) {
  const record = summarizeRecord(matches);
  const recent = matches
    .filter(isPlayed)
    .slice(0, 5)
    .map((match) => ({ id: match.id, result: getMatchResult(match) }))
    .reverse();

  return (
    <section
      aria-label="시즌 전적"
      className="rounded-xl bg-pitch-deep px-5 py-4 text-on-pitch shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <dl className="flex items-center gap-5 md:gap-6">
          <Stat label="경기" value={record.played} />
          <div className="h-8 w-px bg-on-pitch/15" aria-hidden />
          <Stat label="승" value={record.win} accent />
          <Stat label="무" value={record.draw} />
          <Stat label="패" value={record.loss} />
          <div className="h-8 w-px bg-on-pitch/15" aria-hidden />
          <Stat label="득점" value={record.goalsFor} />
          <Stat label="실점" value={record.goalsAgainst} />
        </dl>

        {recent.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-on-pitch/65">최근 {recent.length}경기</span>
            <ol className="flex gap-1" aria-label="최근 경기 결과, 오래된 순">
              {recent.map(({ id, result }) => (
                <li
                  key={id}
                  className={cn("grid size-6 place-items-center rounded-sm text-[11px] font-semibold", RESULT_TONE[result])}
                >
                  {MATCH_RESULT_LABEL[result]}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
