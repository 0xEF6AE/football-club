import { cn } from "@/lib/utils";

type ChipProps = Omit<React.ComponentPropsWithRef<"button">, "type"> & {
  /** 켜짐/꺼짐 토글. aria-pressed로 노출된다. */
  pressed?: boolean;
  /** 색 톤. 기본은 잔디색, amber는 강조 선택용, neutral은 부정/중립 선택용 */
  tone?: "pitch" | "amber" | "neutral";
  size?: "sm" | "md";
};

/** 토글 가능한 알약 버튼. 포지션 선택, 참석 체크, 필터 등에 쓴다. 누르면 살짝 눌린다. */
export function Chip({ pressed = false, tone = "pitch", size = "md", className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-full border font-medium",
        "transition-[color,background-color,border-color,scale] duration-150 active:scale-[0.96]",
        "outline-none focus-visible:ring-2 focus-visible:ring-pitch-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-9 px-3.5 text-sm" : "h-10 px-4 text-[15px]",
        pressed
          ? tone === "amber"
            ? "border-amber bg-amber text-amber-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
            : tone === "neutral"
              ? "border-fg bg-fg text-bg"
              : "border-pitch bg-pitch text-on-pitch shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
          : "border-line bg-surface text-fg hover:border-muted/60 hover:bg-surface-2/60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
