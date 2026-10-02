import { z } from "zod";
import type { FormationShape } from "@/features/formations/schema";

/** 빈 문자열은 null로 정규화한다. 입력/출력 모두 string | null 이라 클라이언트 → 서버 재검증에도 안전하다. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value ? value : null));

const score = z
  .number({ error: "점수를 입력해 주세요" })
  .int("정수만 입력할 수 있어요")
  .min(0, "0 이상이어야 해요")
  .max(99, "99 이하여야 해요");

/** 킥오프는 정각 단위 "HH:00". 빈 문자열은 null(시간 미정)로 정규화한다. */
const kickoffTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):00$/, "킥오프는 정각 단위로 골라 주세요")
  .or(z.literal(""))
  .nullable()
  .transform((value) => (value ? value : null));

export const matchGoalInputSchema = z.object({
  scorerId: z.string().nullable(),
  assistId: z.string().nullable(),
});

export const matchInputSchema = z
  .object({
    playedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "경기 날짜를 선택해 주세요"),
    kickoffTime,
    opponent: z.string().trim().min(1, "상대팀 이름을 입력해 주세요").max(30, "30자까지 가능해요"),
    /** 둘 다 null이면 아직 안 한(예정) 경기. 참석 투표만 받는다. */
    ourScore: score.nullable(),
    theirScore: score.nullable(),
    location: optionalText(50, "장소는 50자까지 가능해요"),
    memo: optionalText(1000, "메모는 1000자까지 가능해요"),
    /** 참석 투표 마감 시각(ISO, UTC). null이면 킥오프 시각(미정이면 경기 당일 0시)에 마감. */
    voteDeadline: z.iso.datetime({ message: "마감 시각을 확인해 주세요" }).nullable(),
    /** 그날 사용한 저장된 포메이션 */
    formationId: z.string().nullable(),
    goals: z.array(matchGoalInputSchema).max(30, "득점 기록은 30개까지 가능해요"),
  })
  .refine((m) => (m.ourScore === null) === (m.theirScore === null), {
    message: "점수는 양쪽 다 입력하거나 비워 두세요",
    path: ["theirScore"],
  })
  .refine((m) => m.ourScore !== null || m.goals.length === 0, {
    message: "결과가 없는 예정 경기에는 득점을 기록할 수 없어요",
    path: ["goals"],
  })
  // 득점 기록이 점수보다 많으면 득점왕 집계가 부풀려진다. (적은 건 괜찮다: 득점자를 모르는 골)
  .refine((m) => m.ourScore === null || m.goals.length <= m.ourScore, {
    message: "득점 기록이 우리 팀 점수보다 많아요",
    path: ["goals"],
  })
  .refine((m) => m.voteDeadline === null || new Date(m.voteDeadline).getTime() <= latestDeadline(m), {
    message: "투표 마감은 킥오프 전이어야 해요 (킥오프 미정이면 경기 날 안에)",
    path: ["voteDeadline"],
  });

export type MatchGoalInput = z.infer<typeof matchGoalInputSchema>;
export type MatchInput = z.infer<typeof matchInputSchema>;

export type MatchGoal = MatchGoalInput & {
  id: string;
  scorerName: string | null;
  assistName: string | null;
};

/** 경기에 붙인 포메이션 요약. shapes는 1~4쿼터 모양. */
export type MatchFormationRef = { id: string; name: string; shapes: FormationShape[] };

export type Match = {
  id: string;
  playedAt: string;
  /** "HH:mm" 또는 null(미정) */
  kickoffTime: string | null;
  opponent: string;
  ourScore: number | null;
  theirScore: number | null;
  location: string | null;
  memo: string | null;
  voteDeadline: string | null;
  /** 추가 모집 마감. null이면 킥오프 2시간 뒤까지 "늦게라도 참석"을 받는다. */
  lateJoinDeadline: string | null;
  formationId: string | null;
  formation: MatchFormationRef | null;
  /** 우천·인원 부족 등으로 취소된 경기 */
  cancelled: boolean;
  cancelReason: string | null;
  goals: MatchGoal[];
  createdAt: string;
};

type Scores = Pick<Match, "ourScore" | "theirScore">;
export type PlayedScores = { ourScore: number; theirScore: number };

/** 결과가 기록된 경기인지. 예정 경기는 점수가 둘 다 null이다. */
export function isPlayed<T extends Scores>(match: T): match is T & PlayedScores {
  return match.ourScore !== null && match.theirScore !== null;
}

/** 킥오프 몇 시간 뒤부터 "결과 입력 대기"로 보는지 */
export const RESULT_DUE_HOURS = 2;

/**
 * 결과를 입력할 때가 됐는데 아직 점수가 없는 경기인지 (한국 시간 기준).
 * 킥오프 시간이 있으면 킥오프 RESULT_DUE_HOURS시간 뒤부터, 없으면 경기 다음 날 0시부터.
 * 목록·상세의 "결과 입력 대기" 표시와 관리자 알림이 모두 이 판정을 쓴다.
 */
export function isAwaitingResult(
  match: Pick<Match, "playedAt" | "kickoffTime" | "ourScore" | "theirScore"> & { cancelled?: boolean },
  now: Date = new Date(),
): boolean {
  if (match.cancelled || isPlayed(match)) return false;
  const dueAt = resultDueAt(match);
  return !Number.isNaN(dueAt) && now.getTime() >= dueAt;
}

/** 결과 입력 대기가 시작되는 시각(ms): 킥오프 RESULT_DUE_HOURS시간 뒤, 미정이면 경기 다음 날 0시 (한국 시간). "늦게라도 참석"도 이때 닫힌다. */
export function resultDueAt(match: Pick<Match, "playedAt" | "kickoffTime">): number {
  return match.kickoffTime
    ? new Date(`${match.playedAt}T${match.kickoffTime}:00+09:00`).getTime() + RESULT_DUE_HOURS * 3_600_000
    : new Date(`${match.playedAt}T00:00:00+09:00`).getTime() + 24 * 3_600_000;
}

/** 참석 투표가 마감됐는지. 마감 시각이 없으면 계속 열려 있다. 클라이언트와 서버가 같은 판정을 쓴다. */
type VoteTarget = Pick<Match, "playedAt" | "kickoffTime" | "voteDeadline" | "ourScore" | "theirScore"> & {
  cancelled?: boolean;
  lateJoinDeadline?: string | null;
};

const DAY_MS = 24 * 3_600_000;
const kstMidnight = (date: string) => new Date(`${date}T00:00:00+09:00`).getTime();

/** 킥오프 시각(ms). 킥오프 미정이면 null */
export function kickoffAt(match: Pick<Match, "playedAt" | "kickoffTime">): number | null {
  if (!match.kickoffTime) return null;
  const at = new Date(`${match.playedAt}T${match.kickoffTime}:00+09:00`).getTime();
  return Number.isNaN(at) ? null : at;
}

export type Countdown = { days: number; hours: number; minutes: number; started: boolean };

/**
 * 킥오프까지 남은 일·시간·분 (분 아래는 버린다). 이미 시작했으면 0·0·0.
 * 킥오프 시간이 미정이면 계산할 수 없어 null.
 */
export function kickoffCountdown(match: Pick<Match, "playedAt" | "kickoffTime">, now: number): Countdown | null {
  const at = kickoffAt(match);
  if (at === null) return null;
  const left = Math.max(0, Math.floor((at - now) / 60_000));
  return { days: Math.floor(left / 1440), hours: Math.floor((left % 1440) / 60), minutes: left % 60, started: left === 0 };
}

/** 직접 정하는 마감이 늦어도 되는 한계: 킥오프, 미정이면 경기 날 끝 */
function latestDeadline(match: Pick<Match, "playedAt" | "kickoffTime">): number {
  return kickoffAt(match) ?? kstMidnight(match.playedAt) + DAY_MS;
}

/**
 * 실제로 적용되는 투표 마감(ISO). 따로 정하지 않으면 킥오프 시각, 킥오프도 미정이면 경기 당일 0시(한국 시간).
 * 그래서 마감을 깜빡해도 끝난 경기에 참석이 바뀌지 않는다.
 */
export function effectiveVoteDeadline(match: Pick<Match, "playedAt" | "kickoffTime" | "voteDeadline">): string {
  if (match.voteDeadline) return match.voteDeadline;
  return new Date(kickoffAt(match) ?? kstMidnight(match.playedAt)).toISOString();
}

/** 참석 투표가 마감됐는지. 취소됐거나 결과가 나온 경기도 마감. 클라이언트와 서버가 같은 판정을 쓴다. */
export function isVoteClosed(match: VoteTarget, now: Date = new Date()): boolean {
  if (match.cancelled || isPlayed(match)) return true;
  const deadline = new Date(effectiveVoteDeadline(match)).getTime();
  return !Number.isNaN(deadline) && deadline <= now.getTime();
}

/**
 * 마감 뒤에도 "늦게라도 참석"은 받는 기간: 마감 뒤 ~ 결과 입력 대기 전(킥오프 2시간 뒤, 미정이면 다음 날 0시).
 * 불참·보류였다가 오게 된 사람이 스스로 알릴 수 있게 한다. 불참·보류로 바꾸는 건 이 기간에도 안 된다.
 */
export function canJoinLate(match: VoteTarget, now: Date = new Date()): boolean {
  if (match.cancelled || isPlayed(match)) return false;
  return isVoteClosed(match, now) && now.getTime() < lateJoinCloseAt(match);
}

/**
 * "늦게라도 참석"이 닫히는 시각(ms). 주장이 추가 모집 마감을 정했으면 그때, 아니면 킥오프 2시간 뒤.
 * 정한 시각이 킥오프 2시간 뒤보다 늦어도 킥오프 2시간 뒤에는 닫는다.
 */
export function lateJoinCloseAt(match: Pick<Match, "playedAt" | "kickoffTime"> & { lateJoinDeadline?: string | null }): number {
  const due = resultDueAt(match);
  if (!match.lateJoinDeadline) return due;
  const set = new Date(match.lateJoinDeadline).getTime();
  return Number.isNaN(set) ? due : Math.min(set, due);
}

/** 추가 모집 마감 정하기(관리자). null이면 기본(킥오프 2시간 뒤)으로 */
export const lateJoinInputSchema = z.object({
  deadline: z.iso.datetime({ message: "마감 시각을 확인해 주세요" }).nullable(),
});

export type MatchResult = "win" | "draw" | "loss";

export const MATCH_RESULT_LABEL: Record<MatchResult, string> = {
  win: "승",
  draw: "무",
  loss: "패",
};

export function getMatchResult(match: PlayedScores): MatchResult {
  if (match.ourScore > match.theirScore) return "win";
  if (match.ourScore < match.theirScore) return "loss";
  return "draw";
}

export type SeasonRecord = {
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
};

/** 결과가 있는 경기만 집계한다. */
export function summarizeRecord(matches: Match[]): SeasonRecord {
  return matches.reduce<SeasonRecord>(
    (acc, match) => {
      if (!isPlayed(match)) return acc;
      acc.played += 1;
      acc[getMatchResult(match)] += 1;
      acc.goalsFor += match.ourScore;
      acc.goalsAgainst += match.theirScore;
      return acc;
    },
    { played: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0 },
  );
}

/**
 * 예정 경기(가까운 날짜부터)와 끝난 경기(결과가 있거나 취소됨, 최신순)로 나눈다.
 * 입력은 서버 정렬(최신순)을 그대로 쓰므로 finished는 순서를 유지한다.
 */
export function splitMatches(matches: Match[]): { upcoming: Match[]; finished: Match[] } {
  const upcoming: Match[] = [];
  const finished: Match[] = [];
  for (const match of matches) (isPlayed(match) || match.cancelled ? finished : upcoming).push(match);
  upcoming.sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  return { upcoming, finished };
}

/** 경기 취소 사유 고르기용 */
export const CANCEL_REASONS = ["우천", "인원 부족", "상대팀 사정", "구장 사정"] as const;

export const cancelInputSchema = z.object({
  cancelled: z.boolean(),
  reason: optionalText(30, "사유는 30자까지 가능해요"),
});
export type CancelInput = z.infer<typeof cancelInputSchema>;

/** 득점자별 골 수를 "이무성 2, 장상준" 형태로 요약 */
export function summarizeScorers(goals: MatchGoal[]): string {
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const goal of goals) {
    if (goal.scorerName) counts.set(goal.scorerName, (counts.get(goal.scorerName) ?? 0) + 1);
    else unknown += 1;
  }
  const parts = [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} ${count}` : name));
  if (unknown > 0) parts.push(`기타 ${unknown}`);
  return parts.join(", ");
}
