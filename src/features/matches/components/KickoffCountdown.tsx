"use client";

import { useMinuteNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { kickoffCountdown, type Match } from "../schema";

const pad = (n: number) => String(n).padStart(2, "0");

type KickoffCountdownProps = {
  match: Pick<Match, "playedAt" | "kickoffTime">;
  /** board: 경기 상세 전광판의 큰 시계 / inline: 목록의 한 줄 */
  variant: "board" | "inline";
  className?: string;
};

/**
 * 킥오프까지 남은 시간 "일:시간:분". 시작했으면 00:00:00. 매분 저절로 줄어든다.
 * 킥오프 시간이 미정이면 아무것도 그리지 않는다(부르는 쪽이 D-day 등을 대신 보여 준다).
 */
export function KickoffCountdown({ match, variant, className }: KickoffCountdownProps) {
  const now = useMinuteNow();
  const left = now === null ? null : kickoffCountdown(match, now);
  if (!match.kickoffTime) return null;

  const parts = left ? [left.days, left.hours, left.minutes] : null;
  const label = left
    ? left.started
      ? "경기가 시작됐어요"
      : `킥오프까지 ${left.days}일 ${left.hours}시간 ${left.minutes}분 남았어요`
    : "킥오프까지 남은 시간";

  if (variant === "inline") {
    return (
      <span
        className={cn("font-display tabular-nums tracking-wide", className, left?.started && "opacity-45")}
        aria-label={label}
        title={label}
      >
        {parts ? parts.map(pad).join(":") : "--:--:--"}
      </span>
    );
  }

  return (
    <span
      role="timer"
      aria-label={label}
      // 킥오프가 지나 00:00:00이면 흐리게
      className={cn("inline-flex items-start gap-1 md:gap-1.5", className, left?.started && "opacity-45")}
    >
      {(parts ?? [null, null, null]).map((value, i) => (
        <span key={i} className="flex items-start gap-1 md:gap-1.5">
          {i > 0 && <span className="font-display text-on-pitch/35">:</span>}
          <span className="flex flex-col items-center">
            <span className="font-display tabular-nums leading-none">{value === null ? "--" : pad(value)}</span>
            <span className="mt-1.5 font-sans text-[11px] font-medium tracking-normal text-on-pitch/60">
              {["일", "시간", "분"][i]}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}
