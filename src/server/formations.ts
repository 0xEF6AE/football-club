import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { formations, matches } from "@/lib/db/schema";
import type { FormationInput, SavedFormation } from "@/features/formations/schema";
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
  return {
    ...input,
    attendingIds: [...new Set(input.attendingIds)],
    quarters: input.quarters.map((quarter) => ({
      shape: quarter.shape,
      assignments: normalizeAssignments(quarter.shape, quarter.assignments),
    })),
  };
}

export async function listFormations(): Promise<SavedFormation[]> {
  return db.select().from(formations).orderBy(desc(formations.updatedAt));
}

export async function getFormation(id: string): Promise<SavedFormation | null> {
  const [row] = await db.select().from(formations).where(eq(formations.id, id)).limit(1);
  return row ?? null;
}

export async function createFormation(input: FormationInput): Promise<SavedFormation> {
  const [row] = await db
    .insert(formations)
    .values({ id: crypto.randomUUID(), ...normalize(input) })
    .returning();
  return row;
}

export async function updateFormation(id: string, input: FormationInput): Promise<SavedFormation | null> {
  const [row] = await db
    .update(formations)
    .set({ ...normalize(input), updatedAt: new Date().toISOString() })
    .where(eq(formations.id, id))
    .returning();
  return row ?? null;
}

/** 포메이션을 지우면 그걸 참조하던 경기의 연결만 끊는다 (FK 강제 여부에 의존하지 않는다). */
export async function deleteFormation(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.update(matches).set({ formationId: null }).where(eq(matches.formationId, id));
    const deleted = await tx.delete(formations).where(eq(formations.id, id)).returning({ id: formations.id });
    return deleted.length > 0;
  });
}
