import { formationInputSchema } from "@/features/formations/schema";
import { deleteFormation, updateFormation } from "@/server/formations";
import { json, noContent, notFound, parseBody, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";

export const PATCH = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  const input = await parseBody(request, formationInputSchema);
  const formation = await updateFormation(id, input);
  if (!formation) throw notFound("저장된 포메이션을 찾을 수 없습니다");
  return json(formation);
});

export const DELETE = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  if (!(await deleteFormation(id))) throw notFound("저장된 포메이션을 찾을 수 없습니다");
  return noContent();
});
