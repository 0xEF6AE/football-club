import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { formations, matches } from "@/lib/db/schema";
import type { FormationInput, SavedFormation } from "@/features/formations/schema";
import { normalizeQuarterList } from "@/features/formations/schema";
import { normalizeAssignments } from "@/features/formations/templates";
import { HttpError } from "./http";

/** 경기에 연결하려는 포메이션이 실제로 있는지. SQLite FK 강제 여부에 의존하지 않고 직접 확인한다. */
export async function assertFormationExists(formationId: string | null) {
  if (formationId && !(await getFormation(formationId))) {
    throw new HttpError(400, "입력값을 확인해 주세요", [
      { path: "formationId", message: "저장된 포메이션을 찾을 수 없어요" },
    ]);
  }
}

function normalize(input: FormationInput): FormationInput {
  const attendingIds = [...new Set(input.attendingIds)];
  const attending = new Set(attendingIds);
  const availability: FormationInput["availability"] = {};
  for (const [id, quarters] of Object.entries(input.availability)) {
    const normalized = normalizeQuarterList(quarters);
    if (attending.has(id) && normalized) availability[id] = normalized;
  }
  return {
    ...input,
    attendingIds,
    guests: input.guests.filter((g) => attending.has(g.id)),
    availability,
    quarters: input.quarters.map((quarter) => ({
      shape: quarter.shape,
      assignments: normalizeAssignments(quarter.shape, quarter.assignments),
    })),
  };
}

type FormationRow = typeof formations.$inferSelect;

/** DB 행 → API 응답. 예전 행(용병·늦참 열이 없던 때)은 빈 값으로 채운다. */
const toSaved = (row: FormationRow): SavedFormation => ({ ...row, guests: row.guests ?? [], availability: row.availability ?? {} });

export async function listFormations(): Promise<SavedFormation[]> {
  const rows = await db.select().from(formations).orderBy(desc(formations.updatedAt));
  return rows.map(toSaved);
}

export async function getFormation(id: string): Promise<SavedFormation | null> {
  const [row] = await db.select().from(formations).where(eq(formations.id, id)).limit(1);
  return row ? toSaved(row) : null;
}

export async function createFormation(input: FormationInput): Promise<SavedFormation> {
  const [row] = await db
    .insert(formations)
    .values({ id: crypto.randomUUID(), ...normalize(input) })
    .returning();
  return toSaved(row);
}

export async function updateFormation(id: string, input: FormationInput): Promise<SavedFormation | null> {
  const [row] = await db
    .update(formations)
    .set({ ...normalize(input), updatedAt: new Date().toISOString() })
    .where(eq(formations.id, id))
    .returning();
  return row ? toSaved(row) : null;
}

/** 포메이션을 지우면 그걸 참조하던 경기의 연결만 끊는다 (FK 강제 여부에 의존하지 않는다). */
export async function deleteFormation(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.update(matches).set({ formationId: null }).where(eq(matches.formationId, id));
    const deleted = await tx.delete(formations).where(eq(formations.id, id)).returning({ id: formations.id });
    return deleted.length > 0;
  });
}
