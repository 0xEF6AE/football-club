/**
 * 메인 화면 킥오프 스플래시. 한 세션(탭)에 한 번만, 동작 줄이기 설정이면 아예 보이지 않는다.
 *
 * 스플래시는 서버 HTML에 처음부터 들어 있어야 본문이 먼저 번쩍 보였다가 덮이는 일이 없다.
 * 그래서 <head>의 인라인 스크립트가 첫 페인트 전에 "이번엔 안 보여 줄지"를 판정해
 * <html data-splash="off">를 붙이고, CSS가 그 경우 스플래시를 숨긴다.
 */
export const SPLASH_SEEN_KEY = "fc:splash-seen";
export const SPLASH_DONE_EVENT = "fc:splashdone";

export const SPLASH_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem("${SPLASH_SEEN_KEY}")){d.setAttribute("data-splash","off")}}catch(e){document.documentElement.setAttribute("data-splash","off")}})();`;

/** 스플래시가 지금 화면을 덮고 있는지 (브라우저 전용) */
export function isSplashActive(): boolean {
  return document.documentElement.getAttribute("data-splash") !== "off" && !!document.querySelector("[data-splash-root]");
}

/** 스플래시가 끝나면(또는 처음부터 없으면) 콜백. 해제 함수를 돌려준다. */
export function onSplashDone(callback: () => void): () => void {
  if (!isSplashActive()) {
    callback();
    return () => {};
  }
  window.addEventListener(SPLASH_DONE_EVENT, callback, { once: true });
  return () => window.removeEventListener(SPLASH_DONE_EVENT, callback);
}
