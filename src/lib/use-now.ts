"use client";

import { useSyncExternalStore } from "react";

/**
 * 분 단위로 갱신되는 현재 시각(ms, 분의 시작). 남은 시간 표시처럼 매분 다시 그려야 하는 화면에 쓴다.
 * 모든 구독자가 타이머 하나를 함께 쓰고, 분이 바뀌는 순간에 맞춰 깨어난다.
 * 서버에서는 시각을 모르므로 null.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule() {
  timer = setTimeout(() => {
    listeners.forEach((listener) => listener());
    schedule();
  }, 60_000 - (Date.now() % 60_000) + 20);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerSnapshot = () => null;

export function useMinuteNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
