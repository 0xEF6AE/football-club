import { matchInputSchema } from "@/features/matches/schema";
import { assertFormationExists } from "@/server/formations";
import { json, parseBody, requireAdmin, withErrorHandling } from "@/server/http";
import { createMatch, listMatches } from "@/server/matches";

export const GET = withErrorHandling(async () => {
  return json(await listMatches());
});

export const POST = withErrorHandling(async (request) => {
  requireAdmin(request);
  const input = await parseBody(request, matchInputSchema);
  await assertFormationExists(input.formationId);
  return json(await createMatch(input), { status: 201 });
});
