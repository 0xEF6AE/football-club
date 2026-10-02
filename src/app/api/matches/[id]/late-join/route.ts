import { effectiveVoteDeadline, isPlayed, lateJoinInputSchema, resultDueAt } from "@/features/matches/schema";
import { HttpError, json, notFound, parseBody, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch, setLateJoinDeadline } from "@/server/matches";

/**
 * 추가 모집 마감 정하기(관리자). 투표 마감 뒤 주장이 보류·불참·미투표에게 다시 물을 때 쓴다.
 * 투표 마감보다 뒤, 킥오프 2시간 뒤보다 앞이어야 한다. null이면 기본(킥오프 2시간 뒤).
 */
export const PUT = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  const { deadline } = await parseBody(request, lateJoinInputSchema);
  const match = await getMatch(id);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  if (isPlayed(match) || match.cancelled) throw new HttpError(400, "끝났거나 취소된 경기예요");
  if (deadline) {
    const at = new Date(deadline).getTime();
    const issue = (message: string) => new HttpError(400, "입력값을 확인해 주세요", [{ path: "deadline", message }]);
    if (at <= new Date(effectiveVoteDeadline(match)).getTime()) throw issue("추가 참석 마감은 투표 마감 뒤여야 해요");
    if (at > resultDueAt(match)) throw issue("킥오프 2시간 뒤까지만 받을 수 있어요");
  }
  return json(await setLateJoinDeadline(id, deadline));
});
