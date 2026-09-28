import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchComments, players } from "@/lib/db/schema";
import type { CommentInput, MatchComment } from "@/features/attendance/schema";

/** 참석 투표 아래 댓글. 작성자 이름을 함께 돌려준다 (선수가 이름을 바꿔도 최신 이름). */
const columns = {
  id: matchComments.id,
  matchId: matchComments.matchId,
  playerId: matchComments.playerId,
  playerName: players.name,
  content: matchComments.content,
  createdAt: matchComments.createdAt,
};

export async function listComments(matchId: string): Promise<MatchComment[]> {
  return db
    .select(columns)
    .from(matchComments)
    .innerJoin(players, eq(matchComments.playerId, players.id))
    .where(eq(matchComments.matchId, matchId))
    .orderBy(asc(matchComments.createdAt));
}

export async function getComment(matchId: string, id: string): Promise<MatchComment | null> {
  const [row] = await db
    .select(columns)
    .from(matchComments)
    .innerJoin(players, eq(matchComments.playerId, players.id))
    .where(and(eq(matchComments.id, id), eq(matchComments.matchId, matchId)))
    .limit(1);
  return row ?? null;
}

export async function createComment(matchId: string, input: CommentInput): Promise<MatchComment> {
  const id = crypto.randomUUID();
  await db.insert(matchComments).values({ id, matchId, playerId: input.playerId, content: input.content });
  return (await getComment(matchId, id))!;
}

export async function deleteComment(matchId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(matchComments)
    .where(and(eq(matchComments.id, id), eq(matchComments.matchId, matchId)))
    .returning({ id: matchComments.id });
  return deleted.length > 0;
}
