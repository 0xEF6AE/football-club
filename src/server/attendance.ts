import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchAttendance } from "@/lib/db/schema";
import type { Attendance, AttendanceInput } from "@/features/attendance/schema";

export async function listAttendance(matchId: string): Promise<Attendance[]> {
  return db
    .select()
    .from(matchAttendance)
    .where(eq(matchAttendance.matchId, matchId))
    .orderBy(asc(matchAttendance.updatedAt));
}

/** 같은 선수의 응답이 있으면 덮어쓴다 (경기 + 선수 유니크). */
export async function setAttendance(matchId: string, input: AttendanceInput): Promise<Attendance> {
  const [row] = await db
    .insert(matchAttendance)
    .values({ id: crypto.randomUUID(), matchId, playerId: input.playerId, status: input.status })
    .onConflictDoUpdate({
      target: [matchAttendance.matchId, matchAttendance.playerId],
      set: { status: input.status, updatedAt: new Date().toISOString() },
    })
    .returning();
  return row;
}

export async function removeAttendance(matchId: string, playerId: string): Promise<boolean> {
  const deleted = await db
    .delete(matchAttendance)
    .where(and(eq(matchAttendance.matchId, matchId), eq(matchAttendance.playerId, playerId)))
    .returning({ id: matchAttendance.id });
  return deleted.length > 0;
}
