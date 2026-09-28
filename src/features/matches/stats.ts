import { isPlayed, summarizeRecord, type Match, type SeasonRecord } from "./schema";

export type PlayerStat = {
  playerId: string;
  name: string;
  goals: number;
  assists: number;
  /** 공격 포인트 = 골 + 도움 */
  points: number;
};

/** 골/도움 순위. 골 → 도움 → 이름순. 지워진 선수(이름 없음)의 기록은 제외한다. */
export function buildLeaderboard(matches: Match[]): PlayerStat[] {
  const stats = new Map<string, PlayerStat>();
  const bump = (playerId: string, name: string, key: "goals" | "assists") => {
    const stat = stats.get(playerId) ?? { playerId, name, goals: 0, assists: 0, points: 0 };
    stat[key] += 1;
    stat.points += 1;
    stats.set(playerId, stat);
  };

  for (const match of matches) {
    if (!isPlayed(match)) continue;
    for (const goal of match.goals) {
      if (goal.scorerId && goal.scorerName) bump(goal.scorerId, goal.scorerName, "goals");
      if (goal.assistId && goal.assistName) bump(goal.assistId, goal.assistName, "assists");
    }
  }

  return [...stats.values()].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name, "ko"),
  );
}

/** 경기가 있는 연도 목록, 최신 연도부터 */
export function listSeasons(matches: Match[]): string[] {
  const years = new Set(matches.map((m) => m.playedAt.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

export function filterSeason(matches: Match[], year: string | null): Match[] {
  if (year === null) return matches;
  return matches.filter((m) => m.playedAt.startsWith(year));
}

/**
 * 상대 이름 비교용 정규화: 공백을 없애고 대소문자를 무시한다.
 * "망원 FC", "망원FC", "망원 fc"는 같은 팀으로 본다. 철자가 다르면(망원FC / 망원 유나이티드) 다른 팀이다.
 */
export function normalizeOpponent(name: string): string {
  return name.replace(/\s+/g, "").toLocaleLowerCase("ko");
}

export type HeadToHead = SeasonRecord & {
  /** 이 상대와 결과가 기록된 경기, 입력 순서(서버 정렬 = 최신순) 유지 */
  matches: Match[];
};

/** 같은 상대와의 역대 전적. 결과가 있는 경기만 센다 (예정 경기 제외). */
export function buildHeadToHead(matches: Match[], opponent: string): HeadToHead {
  const key = normalizeOpponent(opponent);
  const same = matches.filter((m) => isPlayed(m) && normalizeOpponent(m.opponent) === key);
  return { ...summarizeRecord(same), matches: same };
}

/** "3전 2승 1패" 형태. 0인 항목은 뺀다. 경기가 없으면 "0전". */
export function formatRecord(record: SeasonRecord): string {
  const parts = [`${record.played}전`];
  if (record.win > 0) parts.push(`${record.win}승`);
  if (record.draw > 0) parts.push(`${record.draw}무`);
  if (record.loss > 0) parts.push(`${record.loss}패`);
  return parts.join(" ");
}
