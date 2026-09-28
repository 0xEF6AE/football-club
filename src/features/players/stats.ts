import { ATTENDANCE_STATUSES, type Attendance, type AttendanceStatus } from "@/features/attendance/schema";
import {
  getMatchResult,
  isPlayed,
  summarizeRecord,
  type Match,
  type MatchResult,
  type SeasonRecord,
} from "@/features/matches/schema";
import type { Player } from "./schema";

/**
 * 출전으로 센 근거. 앱에 "누가 뛰었다"를 직접 적는 칸은 없어서 세 가지 흔적 중 하나라도 있으면 출전으로 본다.
 * - attendance: 참석 투표에서 "참석"
 * - lineup: 경기에 붙인 포메이션의 어느 쿼터에든 이름이 있음
 * - goal: 그 경기에서 골이나 도움을 기록함
 */
export type AppearanceSource = "attendance" | "lineup" | "goal";

export const APPEARANCE_SOURCE_LABEL: Record<AppearanceSource, string> = {
  attendance: "참석 투표",
  lineup: "포메이션",
  goal: "득점 기록",
};

export type PlayerMatchLine = {
  matchId: string;
  playedAt: string;
  opponent: string;
  ourScore: number;
  theirScore: number;
  result: MatchResult;
  goals: number;
  assists: number;
  appeared: boolean;
  sources: AppearanceSource[];
};

export type PlayerStats = {
  player: Player;
  /** 결과가 기록된 팀 경기 수 */
  teamPlayed: number;
  appearances: number;
  goals: number;
  assists: number;
  /** 출전 ÷ 팀 경기 수 (0~1). 팀 경기가 없으면 null */
  attendanceRate: number | null;
  /** 출전한 경기만의 팀 전적 */
  record: SeasonRecord;
  /** 결과가 기록된 경기, 입력 순서(서버 정렬 = 최신순) 유지 */
  matches: PlayerMatchLine[];
  /** 참석 투표 응답 횟수. 예정 경기 응답도 포함한다. */
  votes: Record<AttendanceStatus, number>;
};

/**
 * 선수 한 명의 기록. 순수 함수라 서버(집계 API)와 테스트가 같은 계산을 쓴다.
 * @param lineupMatchIds 경기에 붙인 포메이션 명단에 이 선수가 들어 있는 경기 id
 */
export function buildPlayerStats(
  player: Player,
  matches: Match[],
  attendance: Attendance[],
  lineupMatchIds: ReadonlySet<string>,
): PlayerStats {
  const attendedMatchIds = new Set(attendance.filter((a) => a.status === "yes").map((a) => a.matchId));

  const votes = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
  for (const a of attendance) votes[a.status] += 1;

  const played = matches.filter(isPlayed);
  const lines: PlayerMatchLine[] = played.map((match) => {
    const goals = match.goals.filter((g) => g.scorerId === player.id).length;
    const assists = match.goals.filter((g) => g.assistId === player.id).length;
    const sources: AppearanceSource[] = [];
    if (attendedMatchIds.has(match.id)) sources.push("attendance");
    if (lineupMatchIds.has(match.id)) sources.push("lineup");
    if (goals + assists > 0) sources.push("goal");
    return {
      matchId: match.id,
      playedAt: match.playedAt,
      opponent: match.opponent,
      ourScore: match.ourScore,
      theirScore: match.theirScore,
      result: getMatchResult(match),
      goals,
      assists,
      appeared: sources.length > 0,
      sources,
    };
  });

  const appearedIds = new Set(lines.filter((l) => l.appeared).map((l) => l.matchId));
  const appearances = appearedIds.size;

  return {
    player,
    teamPlayed: played.length,
    appearances,
    goals: lines.reduce((sum, l) => sum + l.goals, 0),
    assists: lines.reduce((sum, l) => sum + l.assists, 0),
    attendanceRate: played.length === 0 ? null : appearances / played.length,
    record: summarizeRecord(played.filter((m) => appearedIds.has(m.id))),
    matches: lines,
    votes,
  };
}
