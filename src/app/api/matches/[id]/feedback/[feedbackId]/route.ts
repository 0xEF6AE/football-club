import { deleteFeedback } from "@/server/feedback";
import { noContent, notFound, requireAdmin, withErrorHandling } from "@/server/http";

type Context = { params: Promise<{ id: string; feedbackId: string }> };

export const DELETE = withErrorHandling(async (request, { params }: Context) => {
  requireAdmin(request);
  const { id, feedbackId } = await params;
  if (!(await deleteFeedback(id, feedbackId))) throw notFound("피드백을 찾을 수 없습니다");
  return noContent();
});
