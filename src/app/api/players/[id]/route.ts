import { playerInputSchema } from "@/features/players/schema";
import { json, noContent, notFound, parseBody, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";
import { deletePlayer, updatePlayer } from "@/server/players";

export const PATCH = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  const input = await parseBody(request, playerInputSchema);
  const player = await updatePlayer(id, input);
  if (!player) throw notFound("선수를 찾을 수 없습니다");
  return json(player);
});

export const DELETE = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  if (!(await deletePlayer(id))) throw notFound("선수를 찾을 수 없습니다");
  return noContent();
});
