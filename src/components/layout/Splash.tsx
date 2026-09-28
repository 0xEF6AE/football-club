"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLUB_NAME } from "@/lib/config";
import { SPLASH_DONE_EVENT, SPLASH_SEEN_KEY } from "@/lib/splash";

/** 전체 길이(ms). globals.css의 splash-* 키프레임 타이밍과 맞춘다. */
const TOTAL_MS = 2500;
/** 눌러서 건너뛸 때 갈라지는 시간 */
const SKIP_MS = 520;

/**
 * 킥오프 스플래시.
 * 하프라인이 그어지고 → 센터서클이 그려지고 → 엠블럼이 센터 스폿에 떨어지며 금색 링이 퍼진 뒤
 * → 경기장이 하프라인을 따라 위아래로 갈라지며 본문이 드러난다.
 * 표시 여부는 <head> 인라인 스크립트(SPLASH_INIT_SCRIPT)가 첫 페인트 전에 정한다.
 */
export function Splash() {
  const [gone, setGone] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    document.documentElement.setAttribute("data-splash", "off");
    window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
    setGone(true);
  }, []);

  useEffect(() => {
    // 이번에는 보여 주지 않기로 이미 정해졌으면 CSS(html[data-splash="off"] .splash)가 숨기고 있으니 할 일이 없다.
    if (document.documentElement.getAttribute("data-splash") === "off") {
      finished.current = true;
      return;
    }
    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {
      // 저장 못 하면 다음에 한 번 더 보일 뿐이다.
    }
    const timer = window.setTimeout(finish, TOTAL_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") setSkipping(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  useEffect(() => {
    if (!skipping) return;
    const timer = window.setTimeout(finish, SKIP_MS);
    return () => window.clearTimeout(timer);
  }, [skipping, finish]);

  if (gone) return null;

  return (
    <div
      data-splash-root
      data-skipping={skipping || undefined}
      aria-hidden
      onClick={() => setSkipping(true)}
      className="splash fixed inset-0 z-50 cursor-pointer select-none overflow-hidden"
    >
      {/* 갈라지는 두 반쪽. 잔디 줄무늬가 하프라인에서 정확히 이어지도록 같은 배경을 쓴다. */}
      <div className="splash-half splash-half-top absolute inset-x-0 top-0 h-1/2 bg-pitch-deep" />
      <div className="splash-half splash-half-bottom absolute inset-x-0 bottom-0 h-1/2 bg-pitch-deep" />

      <div className="splash-stage absolute inset-0">
        {/* 하프라인 */}
        <div className="splash-halfway absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-pitch-line" />

        {/* 센터서클 + 엠블럼 */}
        <div className="absolute left-1/2 top-1/2 size-60 -translate-x-1/2 -translate-y-1/2 md:size-72">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" fill="none">
            <circle
              className="splash-circle"
              cx="50"
              cy="50"
              r="48"
              pathLength={1}
              stroke="var(--pitch-line)"
              strokeWidth="0.9"
            />
          </svg>
          <span className="splash-ring absolute inset-[22%] rounded-full border-2 border-amber" />
          <div className="splash-emblem absolute inset-[22%]">
            <Image src="/logo.png" alt="" fill sizes="176px" priority className="rounded-full object-contain" />
          </div>
        </div>

        <p className="splash-name absolute inset-x-0 top-[calc(50%+9rem)] text-center text-lg font-semibold tracking-[0.2em] text-on-pitch md:top-[calc(50%+10.5rem)]">
          {CLUB_NAME}
        </p>
      </div>
    </div>
  );
}
