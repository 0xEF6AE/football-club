"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * 처음 "/"로 들어왔을 때뿐 아니라, 앱 안에서 "/"로 올 때(헤더 로고)마다 처음부터 다시 돈다.
 */
export function Splash() {
  const pathname = usePathname();
  // "/"에 도착할 때마다 번호를 올려 연출을 새로 마운트한다(애니메이션이 처음부터 다시 돈다).
  // 이전 경로와 비교해 렌더 중에 갱신하는 방식이라 effect 없이 한 번에 반영된다.
  const [prevPath, setPrevPath] = useState(pathname);
  const [runId, setRunId] = useState(pathname === SPLASH_PATH ? 1 : 0);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (pathname === SPLASH_PATH) setRunId((id) => id + 1);
  }

  if (runId === 0) return null;
  return <SplashRun key={runId} />;
}

/**
 * 연출 한 번.
 * 하프라인 → 센터서클 → 엠블럼 착지 + 금색 링 → (그 사이 /matches로 이동) → 경기장이 갈라지며 경기 화면이 드러난다.
 */
function SplashRun() {
  const pathname = usePathname();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const navigated = useRef(false);

  const goNext = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(SPLASH_NEXT_PATH);
  }, [router]);

  // 첫 페인트 전에 보여 줄지 정한다. 처음 접속이면 <head> 스크립트가 이미 정했고,
  // 앱 안에서 "/"로 온 경우엔 이전 연출이 남긴 data-splash="off"를 여기서 걷어 낸다.
  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) document.documentElement.setAttribute("data-splash", "off");
    else document.documentElement.removeAttribute("data-splash");
  }, []);

  // 연출 타이머. 동작 줄이기 설정이면 곧장 /matches로.
  useEffect(() => {
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
  }, [router, goNext]);

  useEffect(() => {
    if (skipped) goNext();
  }, [skipped, goNext]);

  // 경기 화면으로 넘어갔고 (그리기가 끝났거나 건너뛰었으면) 갈라지기 시작한다.
  const opening = !done && pathname !== SPLASH_PATH && (drawn || skipped);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => {
      document.documentElement.setAttribute("data-splash", "off");
      window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
      setDone(true);
    }, OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [opening]);

  if (done) return null;

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
