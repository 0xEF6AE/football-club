import { feedbackInputSchema } from "@/features/feedback/schema";
import { createFeedback, listFeedback } from "@/server/feedback";
import { json, notFound, parseBody, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listFeedback(id));
});

export const POST = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const input = await parseBody(request, feedbackInputSchema);
  if (!(await getMatch(id))) throw notFound("경기를 찾을 수 없습니다");
  return json(await createFeedback(id, input), { status: 201 });
});
