"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLUB_NAME } from "@/lib/config";
import { SPLASH_DONE_EVENT, SPLASH_NEXT_PATH, SPLASH_PATH } from "@/lib/splash";

/** 그리기 연출이 끝나는 시점(ms). globals.css의 splash-* 키프레임과 맞춘다. */
const DRAWN_MS = 1950;
/** 이 시점에 /matches로 넘어가기 시작한다. 갈라질 때쯤엔 경기 화면이 그려져 있도록 조금 먼저. */
const NAVIGATE_MS = 1500;
/** 경기장이 위아래로 갈라지는 시간. globals.css의 .splash[data-opening] 과 맞춘다. */
const OPEN_MS = 550;

/**
 * 킥오프 스플래시. 레이아웃(AppShell)에 있어서 "/" → "/matches"로 페이지가 바뀌는 동안에도 화면을 덮고 있다.
 * 하프라인 → 센터서클 → 엠블럼 착지 + 금색 링 → (그 사이 /matches로 이동) → 경기장이 갈라지며 경기 화면이 드러난다.
 * 표시 여부는 <head> 인라인 스크립트(SPLASH_INIT_SCRIPT)가 첫 페인트 전에 정한다.
 */
export function Splash() {
  const pathname = usePathname();
  const router = useRouter();
  // 처음 들어온 주소가 "/"일 때만 그린다. 이후 주소가 바뀌어도 연출이 끝날 때까지 유지.
  const [active, setActive] = useState(() => pathname === SPLASH_PATH);
  const [drawn, setDrawn] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const navigated = useRef(false);

  const goNext = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(SPLASH_NEXT_PATH);
  }, [router]);

  // 연출 타이머. 동작 줄이기 등으로 꺼져 있으면 곧장 /matches로.
  useEffect(() => {
    if (!active) return;
    router.prefetch(SPLASH_NEXT_PATH);
    if (document.documentElement.getAttribute("data-splash") === "off") {
      goNext();
      return;
    }
    const navTimer = window.setTimeout(goNext, NAVIGATE_MS);
    const drawnTimer = window.setTimeout(() => setDrawn(true), DRAWN_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") setSkipped(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(navTimer);
      window.clearTimeout(drawnTimer);
      window.removeEventListener("keydown", onKey);
    };
    // active는 처음 한 번만 정해지므로 마운트 때만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipped) goNext();
  }, [skipped, goNext]);

  // 경기 화면으로 넘어갔고 (그리기가 끝났거나 건너뛰었으면) 갈라지기 시작한다.
  const opening = active && pathname !== SPLASH_PATH && (drawn || skipped);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => {
      document.documentElement.setAttribute("data-splash", "off");
      window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
      setActive(false);
    }, OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [opening]);

  if (!active) return null;

  return (
    <div
      data-splash-root
      data-opening={opening || undefined}
      data-skipping={skipped || undefined}
      aria-hidden
      onClick={() => setSkipped(true)}
      className="splash fixed inset-0 z-50 cursor-pointer select-none overflow-hidden"
    >
      {/* 갈라지는 두 반쪽 */}
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
