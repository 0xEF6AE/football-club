import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchGuests } from "@/lib/db/schema";
import type { GuestInput, MatchGuest } from "@/features/attendance/schema";
import { GUEST_ID_PREFIX, normalizeQuarterList } from "@/features/formations/schema";

/** 용병(게스트). 그 경기에만 오는 사람이라 선수 목록·기록과 분리해 경기별로 둔다. */
const toGuest = (row: typeof matchGuests.$inferSelect): MatchGuest => ({
  ...row,
  quarters: normalizeQuarterList(row.quarters),
});

export async function listGuests(matchId: string): Promise<MatchGuest[]> {
  const rows = await db.select().from(matchGuests).where(eq(matchGuests.matchId, matchId)).orderBy(asc(matchGuests.createdAt));
  return rows.map(toGuest);
}

export async function createGuest(matchId: string, input: GuestInput): Promise<MatchGuest> {
  const [row] = await db
    .insert(matchGuests)
    .values({
      id: `${GUEST_ID_PREFIX}${crypto.randomUUID()}`,
      matchId,
      name: input.name,
      positions: input.positions,
      quarters: normalizeQuarterList(input.quarters),
    })
    .returning();
  return toGuest(row);
}

export async function deleteGuest(matchId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(matchGuests)
    .where(and(eq(matchGuests.id, id), eq(matchGuests.matchId, matchId)))
    .returning({ id: matchGuests.id });
  return deleted.length > 0;
}
