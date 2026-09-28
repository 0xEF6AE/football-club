import { playerInputSchema } from "@/features/players/schema";
import { json, parseBody, requireAdmin, withErrorHandling } from "@/server/http";
import { createPlayer, listPlayers } from "@/server/players";

export const GET = withErrorHandling(async () => {
  return json(await listPlayers());
});

export const POST = withErrorHandling(async (request) => {
  requireAdmin(request);
  const input = await parseBody(request, playerInputSchema);
  return json(await createPlayer(input), { status: 201 });
});
