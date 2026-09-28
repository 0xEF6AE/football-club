import { readStorage, STORAGE_KEYS, writeStorage } from "./storage";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABEL: Record<Theme, string> = {
  light: "라이트",
  dark: "다크",
};

const CHANGE_EVENT = "fc:themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** 지금 적용 중인 테마. 직접 고른 적이 없으면 OS 설정을 따른다. 브라우저에서만 부른다. */
export function readTheme(): Theme {
  const stored = readStorage(STORAGE_KEYS.theme);
  if (isTheme(stored)) return stored;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** <html data-theme>를 바꾸고 저장한다. 한번 고르면 그 뒤로는 OS 설정을 따르지 않는다. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  writeStorage(STORAGE_KEYS.theme, theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** useSyncExternalStore용 구독. 이 탭의 변경, 다른 탭의 변경(storage 이벤트), OS 설정 변경을 모두 받는다. */
export function subscribeTheme(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
}

/**
 * 첫 페인트 전에 실행되는 인라인 스크립트. 저장된 테마가 있으면 즉시 적용해
 * 라이트 → 다크로 깜빡이는 걸 막는다. layout.tsx의 <head>에 들어간다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.theme,
)}));if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
