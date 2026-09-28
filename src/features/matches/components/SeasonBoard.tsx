"use client";

import { useEffect, useState } from "react";
import { onSplashDone } from "@/lib/splash";
import { cn } from "@/lib/utils";
import { getMatchResult, isPlayed, MATCH_RESULT_LABEL, summarizeRecord, type Match, type MatchResult } from "../schema";

const RESULT_TONE: Record<MatchResult, string> = {
  win: "bg-amber text-amber-fg",
  draw: "bg-on-pitch/25 text-on-pitch",
  loss: "bg-pitch-line/10 text-on-pitch/60 ring-1 ring-inset ring-on-pitch/30",
};

const COUNT_MS = 900;
const LIGHT_STEP_MS = 90;

/**
 * 전광판 점등: 숫자가 0부터 올라가고, 끝나면 최근 결과가 왼쪽부터 켜진다.
 * 페이지를 새로 열었을 때 한 번만 (다른 탭을 갔다 와도 다시 움직이지 않는다). 스플래시가 있으면 끝난 뒤 시작.
 * 동작 줄이기 설정이면 처음부터 최종 값을 보여 준다.
 */
let boardLitThisLoad = false;

/** 이번에 점등 연출을 할지. 전광판은 데이터를 받은 뒤 브라우저에서만 그려지지만, 혹시 몰라 서버에서는 연출 없이. */
function shouldIgnite() {
  if (boardLitThisLoad || typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useBoardIgnition() {
  const [ignite] = useState(shouldIgnite);
  // 0 → 1 로 가는 진행률. null이면 애니메이션 없이 최종 값.
  const [progress, setProgress] = useState<number | null>(ignite ? 0 : null);
  const [lit, setLit] = useState(!ignite);

  useEffect(() => {
    if (!ignite) return;
    boardLitThisLoad = true;
    let frame = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / COUNT_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(t >= 1 ? null : eased);
        if (t < 1) frame = requestAnimationFrame(tick);
        else setLit(true);
      };
      frame = requestAnimationFrame(tick);
    };
    const unsubscribe = onSplashDone(run);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [ignite]);

  return { value: (n: number) => (progress === null ? n : Math.round(n * progress)), lit, animating: !lit };
}

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
  const { value, lit, animating } = useBoardIgnition();
  const recent = matches
    .filter(isPlayed)
    .slice(0, 5)
    .map((match) => ({ id: match.id, result: getMatchResult(match) }))
    .reverse();

  return (
    <section
      aria-label="시즌 전적"
      aria-busy={animating || undefined}
      className="rounded-xl bg-pitch-deep px-5 py-4 text-on-pitch shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <dl className="flex items-center gap-5 md:gap-6">
          <Stat label="경기" value={value(record.played)} />
          <div className="h-8 w-px bg-on-pitch/15" aria-hidden />
          <Stat label="승" value={value(record.win)} accent />
          <Stat label="무" value={value(record.draw)} />
          <Stat label="패" value={value(record.loss)} />
          <div className="h-8 w-px bg-on-pitch/15" aria-hidden />
          <Stat label="득점" value={value(record.goalsFor)} />
          <Stat label="실점" value={value(record.goalsAgainst)} />
        </dl>

        {recent.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-on-pitch/65">최근 {recent.length}경기</span>
            <ol className="flex gap-1" aria-label="최근 경기 결과, 오래된 순">
              {recent.map(({ id, result }, index) => (
                <li
                  key={id}
                  className={cn(
                    "grid size-6 place-items-center rounded-sm text-[11px] font-semibold",
                    RESULT_TONE[result],
                    lit ? "board-light" : "opacity-15",
                  )}
                  style={lit ? { animationDelay: `${index * LIGHT_STEP_MS}ms` } : undefined}
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
