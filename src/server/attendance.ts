import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchAttendance } from "@/lib/db/schema";
import type { Attendance, AttendanceInput } from "@/features/attendance/schema";
import { normalizeQuarterList } from "@/features/formations/schema";

type AttendanceRow = typeof matchAttendance.$inferSelect;

const toAttendance = (row: AttendanceRow): Attendance => ({
  ...row,
  quarters: row.status === "yes" ? normalizeQuarterList(row.quarters) : null,
  lateJoin: row.lateJoin ?? false,
});

export async function listAttendance(matchId: string): Promise<Attendance[]> {
  const rows = await db
    .select()
    .from(matchAttendance)
    .where(eq(matchAttendance.matchId, matchId))
    .orderBy(asc(matchAttendance.updatedAt));
  return rows.map(toAttendance);
}

/** 한 선수의 모든 경기 응답 (선수 기록용) */
export async function listAttendanceOfPlayer(playerId: string): Promise<Attendance[]> {
  const rows = await db.select().from(matchAttendance).where(eq(matchAttendance.playerId, playerId));
  return rows.map(toAttendance);
}

export async function getAttendance(matchId: string, playerId: string): Promise<Attendance | null> {
  const [row] = await db
    .select()
    .from(matchAttendance)
    .where(and(eq(matchAttendance.matchId, matchId), eq(matchAttendance.playerId, playerId)))
    .limit(1);
  return row ? toAttendance(row) : null;
}

/**
 * 같은 선수의 응답이 있으면 덮어쓴다 (경기 + 선수 유니크).
 * 뛸 수 있는 쿼터는 참석일 때만 남긴다. lateJoin은 라우트가 마감 전후를 보고 정한다.
 */
export async function setAttendance(
  matchId: string,
  input: Pick<AttendanceInput, "playerId" | "status" | "quarters">,
  lateJoin: boolean,
): Promise<Attendance> {
  const quarters = input.status === "yes" ? normalizeQuarterList(input.quarters) : null;
  const [row] = await db
    .insert(matchAttendance)
    .values({ id: crypto.randomUUID(), matchId, playerId: input.playerId, status: input.status, quarters, lateJoin })
    .onConflictDoUpdate({
      target: [matchAttendance.matchId, matchAttendance.playerId],
      set: { status: input.status, quarters, lateJoin, updatedAt: new Date().toISOString() },
    })
    .returning();
  return toAttendance(row);
}

export async function removeAttendance(matchId: string, playerId: string): Promise<boolean> {
  const deleted = await db
    .delete(matchAttendance)
    .where(and(eq(matchAttendance.matchId, matchId), eq(matchAttendance.playerId, playerId)))
    .returning({ id: matchAttendance.id });
  return deleted.length > 0;
}
