import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "2026-09-27" → "9월 27일 (토)" */
export function formatMatchDate(isoDate: string, options?: { withYear?: boolean }) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("ko-KR", {
    ...(options?.withYear ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

/** 킥오프 "HH:mm" → "오전 7시", "오후 3시 30분". 형식이 이상하면 그대로 돌려준다. */
export function formatKickoffTime(time: string) {
  const parsed = /^(\d{2}):(\d{2})$/.exec(time);
  if (!parsed) return time;
  const hour = Number(parsed[1]);
  const minute = Number(parsed[2]);
  if (hour > 23 || minute > 59) return time;
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${period} ${hour12}시` : `${period} ${hour12}시 ${minute}분`;
}

/** "2026-09-27" → "27일 (토)". 월별로 묶인 목록 안에서 쓴다. */
export function formatMatchDay(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric", weekday: "short" }).format(date);
}

/** "2026-09-27" → "2026년 9월" */
export function formatMonth(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 7);
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

/**
 * ISO 타임스탬프 → "9월 27일 (토) 21:00". 마감 시각처럼 "언제"가 중요한 값에 쓴다.
 * 모임이 한국에 있으니 서버(배포 환경은 UTC일 수 있다)와 브라우저가 같은 시각을 보이도록 KST로 고정한다.
 */
export function formatDateTime(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

/** ISO 타임스탬프 → <input type="datetime-local"> 값(브라우저 로컬 시각, "YYYY-MM-DDTHH:mm") */
export function toDateTimeLocal(isoTimestamp: string) {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> 값 → ISO 타임스탬프(UTC). 비어 있거나 잘못됐으면 null. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO 타임스탬프 → "방금 전", "3분 전", "2시간 전", "어제", 그 이후는 날짜 */
export function formatRelativeTime(isoTimestamp: string, now: Date = new Date()) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

  if (abs < 60) return "방금 전";
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
}

/** 오늘부터 해당 날짜까지 남은 일수. 오늘이면 0, 지났으면 음수. */
export function daysUntil(isoDate: string, now: Date = new Date()) {
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** 0 → "D-Day", 3 → "D-3", -2 → "D+2" */
export function formatDday(days: number) {
  if (days === 0) return "D-Day";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

/** 오늘 날짜를 <input type="date"> 값 형식(YYYY-MM-DD)으로 */
export function todayIsoDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
