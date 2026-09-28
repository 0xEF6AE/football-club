import { matchInputSchema } from "@/features/matches/schema";
import { assertFormationExists } from "@/server/formations";
import { json, noContent, notFound, parseBody, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";
import { deleteMatch, getMatch, updateMatch } from "@/server/matches";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  return json(match);
});

export const PATCH = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  const input = await parseBody(request, matchInputSchema);
  await assertFormationExists(input.formationId);
  const match = await updateMatch(id, input);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  return json(match);
});

export const DELETE = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  if (!(await deleteMatch(id))) throw notFound("경기를 찾을 수 없습니다");
  return noContent();
});
