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

/** <input type="time"> 값 "HH:mm". 빈 문자열은 null(시간 미정)로 정규화한다. */
const kickoffTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "시간을 확인해 주세요")
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
    /** 참석 투표 마감 시각(ISO, UTC). null이면 마감 없음. */
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
  formationId: string | null;
  formation: MatchFormationRef | null;
  goals: MatchGoal[];
  createdAt: string;
};

type Scores = Pick<Match, "ourScore" | "theirScore">;
export type PlayedScores = { ourScore: number; theirScore: number };

/** 결과가 기록된 경기인지. 예정 경기는 점수가 둘 다 null이다. */
export function isPlayed<T extends Scores>(match: T): match is T & PlayedScores {
  return match.ourScore !== null && match.theirScore !== null;
}

/** 참석 투표가 마감됐는지. 마감 시각이 없으면 계속 열려 있다. 클라이언트와 서버가 같은 판정을 쓴다. */
export function isVoteClosed(match: Pick<Match, "voteDeadline">, now: Date = new Date()): boolean {
  if (match.voteDeadline === null) return false;
  const deadline = new Date(match.voteDeadline).getTime();
  return !Number.isNaN(deadline) && deadline <= now.getTime();
}

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
 * 예정 경기(가까운 날짜부터)와 지난 경기(최신순)로 나눈다.
 * 입력은 서버 정렬(최신순)을 그대로 쓰므로 played는 순서를 유지한다.
 */
export function splitMatches(matches: Match[]): { upcoming: Match[]; played: Match[] } {
  const upcoming: Match[] = [];
  const played: Match[] = [];
  for (const match of matches) (isPlayed(match) ? played : upcoming).push(match);
  upcoming.sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  return { upcoming, played };
}

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
