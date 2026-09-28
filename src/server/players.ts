import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { formations, matchAttendance, matchComments, matchGoals, players } from "@/lib/db/schema";
import type { Player, PlayerInput } from "@/features/players/schema";
import { buildPlayerStats, type PlayerStats } from "@/features/players/stats";
import { listMatches } from "./matches";

export async function listPlayers(): Promise<Player[]> {
  return db.select().from(players).orderBy(asc(players.createdAt), asc(players.name));
}

export async function getPlayer(id: string): Promise<Player | null> {
  const [row] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return row ?? null;
}

/**
 * 선수 한 명의 기록(출전·골·도움·참석률·경기별 내역).
 * 계산은 features/players/stats.ts의 순수 함수가 하고, 여기서는 재료(경기, 응답, 포메이션 명단 포함 여부)만 모은다.
 */
export async function getPlayerStats(id: string): Promise<PlayerStats | null> {
  const player = await getPlayer(id);
  if (!player) return null;

  const [matches, attendance] = await Promise.all([
    listMatches(),
    db.select().from(matchAttendance).where(eq(matchAttendance.playerId, id)),
  ]);

  // 경기에 붙인 포메이션의 어느 쿼터에든 이 선수가 있으면 그 경기는 출전으로 본다.
  const formationIds = [...new Set(matches.map((m) => m.formationId).filter((v): v is string => v !== null))];
  const linked =
    formationIds.length === 0
      ? []
      : await db
          .select({ id: formations.id, quarters: formations.quarters })
          .from(formations)
          .where(inArray(formations.id, formationIds));
  const formationsWithPlayer = new Set(
    linked.filter((f) => f.quarters.some((q) => Object.values(q.assignments).includes(id))).map((f) => f.id),
  );
  const lineupMatchIds = new Set(
    matches.filter((m) => m.formationId !== null && formationsWithPlayer.has(m.formationId)).map((m) => m.id),
  );

  return buildPlayerStats(player, matches, attendance, lineupMatchIds);
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
