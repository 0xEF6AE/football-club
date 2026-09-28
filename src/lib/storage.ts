/**
 * localStorage 래퍼. 사생활 모드·용량 초과·SSR 등 어떤 이유로든 실패하면 조용히 null/무시.
 * 여기 담는 건 이 기기에서만 의미 있는 편의 값(테마, 내 이름, 작업 중 라인업)뿐이다.
 */
export function readStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 못 해도 기능은 동작해야 한다.
  }
}

export function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 무시
  }
}

export const STORAGE_KEYS = {
  theme: "fc:theme",
  me: "fc:me",
  lineupDraft: "fc:lineup-draft",
} as const;
