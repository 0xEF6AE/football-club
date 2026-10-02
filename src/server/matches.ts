import { asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import { feedbacks, formations, matchAttendance, matchComments, matchGoals, matchGuests, matches, players } from "@/lib/db/schema";
import type { Match, MatchGoal, MatchInput } from "@/features/matches/schema";
import type { QuarterLineup } from "@/features/formations/schema";

type MatchRow = typeof matches.$inferSelect;
type JoinedRow = { match: MatchRow; formationName: string | null; formationQuarters: QuarterLineup[] | null };

/**
 * 득점 기록을 읽어 matchId별로 묶는다 (N+1 방지).
 * matchIds가 null이면 전체를 읽는다. 경기 목록은 결국 모든 득점이 필요하므로, 경기 조회를 기다리지 않고
 * 동시에 보내 DB 왕복을 한 번으로 줄이는 용도다 (DB가 원격이라 왕복 수가 곧 응답 시간).
 */
async function loadGoalsByMatch(matchIds: string[] | null): Promise<Map<string, MatchGoal[]>> {
  const grouped = new Map<string, MatchGoal[]>();
  if (matchIds !== null && matchIds.length === 0) return grouped;

  const scorer = alias(players, "scorer");
  const assist = alias(players, "assist");

  const query = db
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
    .orderBy(asc(matchGoals.sortOrder));
  const rows = await (matchIds === null ? query : query.where(inArray(matchGoals.matchId, matchIds)));

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

function hydrate(rows: JoinedRow[], goalsByMatch: Map<string, MatchGoal[]>): Match[] {
  return rows.map(({ match, formationName, formationQuarters }) => ({
    ...match,
    cancelled: match.cancelled ?? false,
    goals: goalsByMatch.get(match.id) ?? [],
    formation:
      match.formationId && formationName && formationQuarters
        ? { id: match.formationId, name: formationName, shapes: formationQuarters.map((q) => q.shape) }
        : null,
  }));
}

export async function listMatches(): Promise<Match[]> {
  const [rows, goalsByMatch] = await Promise.all([
    selectMatches().orderBy(desc(matches.playedAt), desc(matches.createdAt)),
    loadGoalsByMatch(null),
  ]);
  return hydrate(rows, goalsByMatch);
}

export async function getMatch(id: string): Promise<Match | null> {
  const [rows, goalsByMatch] = await Promise.all([
    selectMatches().where(eq(matches.id, id)).limit(1),
    loadGoalsByMatch([id]),
  ]);
  if (rows.length === 0) return null;
  const [match] = hydrate(rows, goalsByMatch);
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
    // 결과를 입력하면 취소 상태는 풀린다 (취소했다가 결국 경기를 한 경우).
    const cancelPatch = fields.ourScore !== null ? { cancelled: false, cancelReason: null } : {};
    const rows = await tx
      .update(matches)
      .set({ ...fields, ...cancelPatch })
      .where(eq(matches.id, id))
      .returning({ id: matches.id });
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
    await tx.delete(matchGuests).where(eq(matchGuests.matchId, id));
    await tx.delete(feedbacks).where(eq(feedbacks.matchId, id));
    const deleted = await tx.delete(matches).where(eq(matches.id, id)).returning({ id: matches.id });
    return deleted.length > 0;
  });
}

/** 경기 취소/되돌리기. 결과가 있는 경기는 취소할 수 없다(라우트가 확인). */
export async function setMatchCancelled(id: string, cancelled: boolean, reason: string | null): Promise<Match | null> {
  const rows = await db
    .update(matches)
    .set({ cancelled, cancelReason: cancelled ? reason : null })
    .where(eq(matches.id, id))
    .returning({ id: matches.id });
  return rows.length > 0 ? getMatch(id) : null;
}

/** 추가 모집 마감(늦게라도 참석을 받는 마지막 시각) 정하기. null이면 기본(킥오프 2시간 뒤). */
export async function setLateJoinDeadline(id: string, deadline: string | null): Promise<Match | null> {
  const rows = await db.update(matches).set({ lateJoinDeadline: deadline }).where(eq(matches.id, id)).returning({ id: matches.id });
  return rows.length > 0 ? getMatch(id) : null;
}
