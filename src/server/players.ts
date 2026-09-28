import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchAttendance, matchComments, matchGoals, players } from "@/lib/db/schema";
import type { Player, PlayerInput } from "@/features/players/schema";

export async function listPlayers(): Promise<Player[]> {
  return db.select().from(players).orderBy(asc(players.createdAt), asc(players.name));
}

export async function getPlayer(id: string): Promise<Player | null> {
  const [row] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return row ?? null;
}

export async function createPlayer(input: PlayerInput): Promise<Player> {
  const [row] = await db
    .insert(players)
    .values({ id: crypto.randomUUID(), ...input })
    .returning();
  return row;
}

export async function updatePlayer(id: string, input: PlayerInput): Promise<Player | null> {
  const [row] = await db.update(players).set(input).where(eq(players.id, id)).returning();
  return row ?? null;
}

/**
 * 선수를 지우면 득점/어시스트 기록은 남기되 선수 참조만 비운다.
 * (SQLite는 연결마다 FK 강제 여부가 달라 onDelete에 의존하지 않고 직접 처리한다.)
 * 포메이션에 남은 id는 불러올 때 클라이언트가 걸러낸다.
 */
export async function deletePlayer(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.update(matchGoals).set({ scorerId: null }).where(eq(matchGoals.scorerId, id));
    await tx.update(matchGoals).set({ assistId: null }).where(eq(matchGoals.assistId, id));
    await tx.delete(matchAttendance).where(eq(matchAttendance.playerId, id));
    await tx.delete(matchComments).where(eq(matchComments.playerId, id));
    const deleted = await tx.delete(players).where(eq(players.id, id)).returning({ id: players.id });
    return deleted.length > 0;
  });
}
