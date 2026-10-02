import { summarizeShapes } from "@/features/formations/schema";
import { formatDateTime, formatKickoffTime, formatMatchDate } from "@/lib/utils";
import { effectiveVoteDeadline, getMatchResult, isPlayed, lateJoinCloseAt, MATCH_RESULT_LABEL, type Match } from "./schema";

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
    // 예정 경기는 "10월 4일 (일) 오전 7시 망원 FC전 예정"처럼 시간까지 한 줄에.
    const when = match.kickoffTime ? `${date} ${formatKickoffTime(match.kickoffTime)}` : date;
    lines.push(`${when} ${match.opponent}전 예정`);
  }

  if (match.location) lines.push(`장소: ${match.location}`);
  if (!isPlayed(match)) lines.push(`투표 마감: ${formatDateTime(effectiveVoteDeadline(match))}`);
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
  const date = formatMatchDate(match.playedAt);
  const when = match.kickoffTime ? `${date} ${formatKickoffTime(match.kickoffTime)}` : date;
  const until = formatDateTime(new Date(lateJoinCloseAt(match)).toISOString());
  const lines = [
    `[${when} ${match.opponent}전 추가 참석 확인]`,
    "투표는 마감됐어요. 아래 분들 중 올 수 있는 분은 링크에서 '늦게라도 참석'을 눌러 주세요.",
    `${until}까지 받아요.`,
  ];
  if (groups.maybe.length > 0) lines.push(`보류: ${groups.maybe.join(", ")}`);
  if (groups.no.length > 0) lines.push(`불참: ${groups.no.join(", ")}`);
  if (groups.none.length > 0) lines.push(`미투표: ${groups.none.join(", ")}`);
  lines.push(`지금 참석 ${groups.attending}명${groups.guests > 0 ? ` + 용병 ${groups.guests}명` : ""}`);
  if (url) lines.push(url);
  return lines.join("\n");
}
