"use client";

import type { Player } from "@/features/players/schema";
import { cn } from "@/lib/utils";
import { getSlotFit } from "../auto-lineup";
import type { FormationSlot, LineupAssignments } from "../schema";

type PitchProps = {
  slots: FormationSlot[];
  assignments: LineupAssignments;
  playersById: ReadonlyMap<string, Player>;
  selectedSlotId: string | null;
  onTapSlot?: (slotId: string) => void;
  /** 보기 전용이면 슬롯이 버튼이 아니라 그냥 그림이다. */
  readOnly?: boolean;
};

/** 세로로 세운 피치. 위가 상대 골문, 아래가 우리 골문. 좌표는 templates.ts의 x/y(%)를 그대로 쓴다. */
export function Pitch({ slots, assignments, playersById, selectedSlotId, onTapSlot, readOnly = false }: PitchProps) {
  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-xl bg-pitch shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]"
      style={{
        aspectRatio: "68 / 105",
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 12.5%, transparent 12.5% 25%)",
      }}
    >
      <PitchLines />

      {slots.map((slot) => {
        const playerId = assignments[slot.id];
        const player = playerId ? playersById.get(playerId) : undefined;
        const fit = player ? getSlotFit(slot, player) : null;
        const selected = selectedSlotId === slot.id;
        const label = player ? `${slot.position} ${player.name}` : `${slot.position} 빈 자리`;

        const content = (
          <>
            <span
              className={cn(
                "font-display relative grid size-11 place-items-center rounded-full text-sm tracking-wide transition-[transform,box-shadow] md:size-12",
                player
                  ? "bg-on-pitch text-pitch-deep shadow-md"
                  : "border-2 border-dashed border-pitch-line/70 text-pitch-line",
                selected && "scale-105 ring-3 ring-amber ring-offset-2 ring-offset-pitch",
                !readOnly &&
                  "group-focus-visible:ring-3 group-focus-visible:ring-amber/80 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-pitch",
              )}
            >
              {slot.position}
              {fit && fit !== "primary" && (
                <span
                  aria-hidden
                  title={fit === "fallback" ? "유사 포지션" : "맞지 않는 포지션"}
                  className={cn(
                    "absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-pitch",
                    fit === "fallback" ? "bg-amber" : "bg-loss",
                  )}
                />
              )}
            </span>
            {player && (
              <span className="max-w-19 truncate rounded bg-pitch-deep/85 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-on-pitch md:text-xs">
                {player.name}
              </span>
            )}
          </>
        );

        const positionStyle = { left: `${slot.x}%`, top: `${slot.y}%` };
        const baseClass = "group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 outline-none";

        if (readOnly) {
          return (
            <div key={slot.id} aria-label={label} role="img" className={baseClass} style={positionStyle}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => onTapSlot?.(slot.id)}
            aria-pressed={selected}
            aria-label={label}
            className={baseClass}
            style={positionStyle}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

/** 초크 라인. 68×105m 실제 비율, 선 굵기는 화면 픽셀 기준으로 고정. */
function PitchLines() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 68 105"
      className="absolute inset-0 h-full w-full **:[vector-effect:non-scaling-stroke]"
      fill="none"
      stroke="var(--pitch-line)"
      strokeWidth="1.5"
    >
      <rect x="1.5" y="1.5" width="65" height="102" />
      <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" />
      <circle cx="34" cy="52.5" r="9.15" />
      <circle cx="34" cy="52.5" r="0.4" fill="var(--pitch-line)" />

      <rect x="13.84" y="1.5" width="40.32" height="16.5" />
      <rect x="24.84" y="1.5" width="18.32" height="5.5" />
      <circle cx="34" cy="12.5" r="0.4" fill="var(--pitch-line)" />
      <path d="M 26.69 18 A 9.15 9.15 0 0 0 41.31 18" />

      <rect x="13.84" y="87" width="40.32" height="16.5" />
      <rect x="24.84" y="98" width="18.32" height="5.5" />
      <circle cx="34" cy="92.5" r="0.4" fill="var(--pitch-line)" />
      <path d="M 26.69 87 A 9.15 9.15 0 0 1 41.31 87" />
    </svg>
  );
}
