import { summarizeShapes } from "@/features/formations/schema";
import { formatDateTime, formatKickoffTime, formatMatchDate } from "@/lib/utils";
import {
  effectiveVoteDeadline,
  getMatchResult,
  isPlayed,
  kickoffAt,
  lateJoinCloseAt,
  MATCH_RESULT_LABEL,
  type Match,
} from "./schema";

type DeadlineFields = Pick<Match, "playedAt" | "kickoffTime" | "voteDeadline">;

/** 킥오프 "10월 4일 (일) 오전 7시". 시간이 미정이면 null. */
export function formatKickoff(match: Pick<Match, "playedAt" | "kickoffTime">): string | null {
  return match.kickoffTime ? `${formatMatchDate(match.playedAt)} ${formatKickoffTime(match.kickoffTime)}` : null;
}

/**
 * 투표 마감을 킥오프와 헷갈리지 않게 적는다.
 * 따로 정했으면 "10월 3일 (토) 오후 9시", 안 정했으면 "킥오프 때(오전 7시)", 킥오프도 미정이면 경기 당일 0시.
 */
export function formatVoteDeadline(match: DeadlineFields): string {
  if (!match.voteDeadline && match.kickoffTime) return `킥오프 때(${formatKickoffTime(match.kickoffTime)})`;
  return formatDateTime(effectiveVoteDeadline(match));
}

/** 따로 정한 투표 마감이 킥오프보다 얼마나 앞인지: "킥오프 10시간 전", "킥오프 1일 10시간 전". 비교할 게 없으면 null. */
export function formatDeadlineLead(match: DeadlineFields): string | null {
  const kickoff = kickoffAt(match);
  if (!match.voteDeadline || kickoff === null) return null;
  const minutes = Math.round((kickoff - new Date(match.voteDeadline).getTime()) / 60_000);
  if (!(minutes > 0)) return null;
  const parts = [
    [Math.floor(minutes / 1440), "일"],
    [Math.floor((minutes % 1440) / 60), "시간"],
    [minutes % 60, "분"],
  ] as const;
  const text = parts
    .filter(([n]) => n > 0)
    .slice(0, 2)
    .map(([n, unit]) => `${n}${unit}`)
    .join(" ");
  return `킥오프 ${text} 전`;
}

/** 카톡방에 붙여 넣을 경기 요약. url이 있으면 마지막 줄에 링크를 붙인다. */
export function formatMatchText(match: Match, clubName: string, url?: string): string {
  const date = formatMatchDate(match.playedAt);
  const lines: string[] = [];

  if (match.cancelled) {
    lines.push(`${date} ${match.opponent}전 취소${match.cancelReason ? ` (${match.cancelReason})` : ""}`);
    if (match.location) lines.push(`장소: ${match.location}`);
    if (url) lines.push(url);
    return lines.join("\n");
  }

  if (isPlayed(match)) {
    lines.push(`${date} ${match.opponent}전 결과`);
    lines.push(
      `${clubName} ${match.ourScore} : ${match.theirScore} ${match.opponent} (${MATCH_RESULT_LABEL[getMatchResult(match)]})`,
    );
    const goals = match.goals.map(
      (goal) => `${goal.scorerName ?? "미상"}${goal.assistName ? ` (도움 ${goal.assistName})` : ""}`,
    );
    if (goals.length > 0) lines.push(`득점: ${goals.join(", ")}`);
  } else {
    // 시각이 둘(킥오프, 투표 마감)이라 각각 이름을 붙여 따로 적는다.
    lines.push(`${date} ${match.opponent}전 예정`);
    const kickoff = formatKickoff(match);
    if (kickoff) lines.push(`킥오프: ${kickoff}`);
  }

  if (match.location) lines.push(`장소: ${match.location}`);
  if (!isPlayed(match)) lines.push(`투표 마감: ${formatVoteDeadline(match)}`);
  if (match.formation) {
    lines.push(`포메이션: ${match.formation.name} (${summarizeShapes(match.formation.shapes)})`);
  }
  if (url) lines.push(isPlayed(match) ? `피드백 남기기: ${url}` : `참석 투표: ${url}`);

  return lines.join("\n");
}

type SecondCallGroups = {
  maybe: readonly string[];
  no: readonly string[];
  none: readonly string[];
  /** 지금 참석 수 (선수) */
  attending: number;
  guests: number;
};

/**
 * 투표 마감 뒤 주장이 단톡방에 다시 묻는 글: "보류·불참·미투표 중에 올 수 있는 사람 있어요?"
 * 링크에서 "늦게라도 참석"을 누르면 되고, 추가 모집 마감까지 받는다.
 */
export function formatSecondCallText(match: Match, groups: SecondCallGroups, url?: string): string {
  const kickoff = formatKickoff(match);
  const until = formatDateTime(new Date(lateJoinCloseAt(match)).toISOString());
  const lines = [
    `[${formatMatchDate(match.playedAt)} ${match.opponent}전 추가 참석 확인]`,
    ...(kickoff ? [`킥오프: ${kickoff}`] : []),
    "투표는 마감됐어요. 아래 분들 중 올 수 있는 분은 링크에서 '늦게라도 참석'을 눌러 주세요.",
    `추가 참석 마감: ${until}`,
  ];
  if (groups.maybe.length > 0) lines.push(`보류: ${groups.maybe.join(", ")}`);
  if (groups.no.length > 0) lines.push(`불참: ${groups.no.join(", ")}`);
  if (groups.none.length > 0) lines.push(`미투표: ${groups.none.join(", ")}`);
  lines.push(`지금 참석 ${groups.attending}명${groups.guests > 0 ? ` + 용병 ${groups.guests}명` : ""}`);
  if (url) lines.push(url);
  return lines.join("\n");
}
