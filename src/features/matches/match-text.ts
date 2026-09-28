import { summarizeShapes } from "@/features/formations/schema";
import { formatDateTime, formatMatchDate } from "@/lib/utils";
import { getMatchResult, isPlayed, MATCH_RESULT_LABEL, type Match } from "./schema";

/** 카톡방에 붙여 넣을 경기 요약. url이 있으면 마지막 줄에 링크를 붙인다. */
export function formatMatchText(match: Match, clubName: string, url?: string): string {
  const date = formatMatchDate(match.playedAt);
  const lines: string[] = [];

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
    lines.push(`${date} ${match.opponent}전 예정`);
  }

  if (match.location) lines.push(`장소: ${match.location}`);
  if (!isPlayed(match) && match.voteDeadline) lines.push(`투표 마감: ${formatDateTime(match.voteDeadline)}`);
  if (match.formation) {
    lines.push(`포메이션: ${match.formation.name} (${summarizeShapes(match.formation.shapes)})`);
  }
  if (url) lines.push(isPlayed(match) ? `피드백 남기기: ${url}` : `참석 투표: ${url}`);

  return lines.join("\n");
}
