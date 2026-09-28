import { feedbackInputSchema, isFeedbackOpen } from "@/features/feedback/schema";
import { isPlayed } from "@/features/matches/schema";
import { createFeedback, isFeedbackRateLimited, listFeedback } from "@/server/feedback";
import { HttpError, json, notFound, parseBody, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listFeedback(id));
});

/**
 * 익명 피드백. 요청의 헤더·쿠키·IP는 읽지 않는다 (본문만 검증해 저장).
 * 결과가 기록된 경기에만, 경기 후 2주까지, 도배 방지 제한 안에서 받는다.
 */
export const POST = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const input = await parseBody(request, feedbackInputSchema);
  const match = await getMatch(id);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  if (!isPlayed(match)) throw new HttpError(400, "결과가 기록된 경기에만 피드백을 남길 수 있어요");
  if (!isFeedbackOpen(match)) throw new HttpError(403, "피드백은 경기 후 2주까지만 받아요");
  if (await isFeedbackRateLimited(id)) {
    throw new HttpError(429, "지금 피드백이 너무 많이 올라오고 있어요. 잠시 후 다시 남겨 주세요");
  }
  return json(await createFeedback(id, input), { status: 201 });
});
