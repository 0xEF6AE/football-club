import { formationInputSchema } from "@/features/formations/schema";
import { createFormation, listFormations } from "@/server/formations";
import { json, parseBody, requireAdmin, withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(async () => {
  return json(await listFormations());
});

export const POST = withErrorHandling(async (request) => {
  requireAdmin(request);
  const input = await parseBody(request, formationInputSchema);
  return json(await createFormation(input), { status: 201 });
});
