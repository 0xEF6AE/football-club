import { cn } from "@/lib/utils";

/**
 * 떠 있는 목록(Select, PlayerPicker)의 공통 모양과 위치 계산.
 * 떠 있는 층이라 그림자를 둔다 (디자인 규칙의 예외: 전광판 패널·대화상자·목록 팝오버).
 */
export type PopoverPlacement = "top" | "bottom";

/** 목록 최대 높이(max-h-64 = 256px) + 여백 */
const LIST_SPACE = 264;
/** 모바일 하단 탭과 상단 바 높이만큼은 쓸 수 없는 공간으로 본다 */
const BOTTOM_RESERVED = 80;
const TOP_RESERVED = 64;

/** 아래 공간이 모자라고 위가 더 넓으면 위로 연다. 여는 순간(이벤트 처리 중)에 한 번 잰다. */
export function placementFor(anchor: HTMLElement | null): PopoverPlacement {
  if (!anchor) return "bottom";
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - BOTTOM_RESERVED;
  const above = rect.top - TOP_RESERVED;
  return below < LIST_SPACE && above > below ? "top" : "bottom";
}

export function popoverStyles(placement: PopoverPlacement) {
  return cn(
    "absolute inset-x-0 z-30 max-h-64 overflow-auto overscroll-contain rounded-xl border border-line bg-surface p-1",
    "shadow-lg shadow-black/10 dark:shadow-black/40",
    // 열릴 때 살짝 미끄러지며 나타난다 (@starting-style)
    "transition-[opacity,translate] duration-150 ease-out starting:opacity-0",
    placement === "top" ? "bottom-full mb-1.5 starting:translate-y-1" : "top-full mt-1.5 starting:-translate-y-1",
  );
}

export function optionStyles({ active, selected }: { active: boolean; selected: boolean }) {
  return cn(
    "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[15px] transition-colors",
    active && "bg-surface-2",
    selected && "font-semibold",
  );
}
