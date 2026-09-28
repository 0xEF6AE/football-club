import { asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import { feedbacks, formations, matchAttendance, matchComments, matchGoals, matches, players } from "@/lib/db/schema";
import type { Match, MatchGoal, MatchInput } from "@/features/matches/schema";
import type { QuarterLineup } from "@/features/formations/schema";

type MatchRow = typeof matches.$inferSelect;
type JoinedRow = { match: MatchRow; formationName: string | null; formationQuarters: QuarterLineup[] | null };

/** 여러 경기의 득점 기록을 한 번에 조회해 matchId별로 묶는다 (N+1 방지). */
async function loadGoalsByMatch(matchIds: string[]): Promise<Map<string, MatchGoal[]>> {
  const grouped = new Map<string, MatchGoal[]>();
  if (matchIds.length === 0) return grouped;

  const scorer = alias(players, "scorer");
  const assist = alias(players, "assist");

  const rows = await db
    .select({
      id: matchGoals.id,
      matchId: matchGoals.matchId,
      scorerId: matchGoals.scorerId,
      scorerName: scorer.name,
      assistId: matchGoals.assistId,
      assistName: assist.name,
    })
    .from(matchGoals)
    .leftJoin(scorer, eq(matchGoals.scorerId, scorer.id))
    .leftJoin(assist, eq(matchGoals.assistId, assist.id))
    .where(inArray(matchGoals.matchId, matchIds))
    .orderBy(asc(matchGoals.sortOrder));

  for (const { matchId, ...goal } of rows) {
    const list = grouped.get(matchId) ?? [];
    list.push(goal);
    grouped.set(matchId, list);
  }
  return grouped;
}

/** 경기 + 사용한 포메이션 이름/쿼터별 모양을 함께 읽는다. */
function selectMatches() {
  return db
    .select({ match: matches, formationName: formations.name, formationQuarters: formations.quarters })
    .from(matches)
    .leftJoin(formations, eq(matches.formationId, formations.id));
}

async function hydrate(rows: JoinedRow[]): Promise<Match[]> {
  const goalsByMatch = await loadGoalsByMatch(rows.map((r) => r.match.id));
  return rows.map(({ match, formationName, formationQuarters }) => ({
    ...match,
    goals: goalsByMatch.get(match.id) ?? [],
    formation:
      match.formationId && formationName && formationQuarters
        ? { id: match.formationId, name: formationName, shapes: formationQuarters.map((q) => q.shape) }
        : null,
  }));
}

export async function listMatches(): Promise<Match[]> {
  const rows = await selectMatches().orderBy(desc(matches.playedAt), desc(matches.createdAt));
  return hydrate(rows);
}

export async function getMatch(id: string): Promise<Match | null> {
  const rows = await selectMatches().where(eq(matches.id, id)).limit(1);
  if (rows.length === 0) return null;
  const [match] = await hydrate(rows);
  return match;
}

function toGoalRows(matchId: string, goals: MatchInput["goals"]) {
  return goals.map((goal, index) => ({
    id: crypto.randomUUID(),
    matchId,
    scorerId: goal.scorerId,
    assistId: goal.assistId,
    sortOrder: index,
  }));
}

export async function createMatch(input: MatchInput): Promise<Match> {
  const { goals, ...fields } = input;
  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(matches).values({ id, ...fields });
    if (goals.length > 0) await tx.insert(matchGoals).values(toGoalRows(id, goals));
  });

  return (await getMatch(id))!;
}

export async function updateMatch(id: string, input: MatchInput): Promise<Match | null> {
  const { goals, ...fields } = input;

  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(matches).set(fields).where(eq(matches.id, id)).returning({ id: matches.id });
    if (rows.length === 0) return false;
    await tx.delete(matchGoals).where(eq(matchGoals.matchId, id));
    if (goals.length > 0) await tx.insert(matchGoals).values(toGoalRows(id, goals));
    return true;
  });

  return updated ? getMatch(id) : null;
}

/** SQLite는 연결마다 FK 강제 여부가 달라 onDelete cascade에 의존하지 않고 직접 지운다. */
export async function deleteMatch(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.delete(matchGoals).where(eq(matchGoals.matchId, id));
    await tx.delete(matchAttendance).where(eq(matchAttendance.matchId, id));
    await tx.delete(matchComments).where(eq(matchComments.matchId, id));
    await tx.delete(feedbacks).where(eq(feedbacks.matchId, id));
    const deleted = await tx.delete(matches).where(eq(matches.id, id)).returning({ id: matches.id });
    return deleted.length > 0;
  });
}
