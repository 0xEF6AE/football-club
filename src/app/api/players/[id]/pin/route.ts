import { noContent, notFound, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";
import { resetPin } from "@/server/pin";

/** 관리자: PIN을 잊은 선수의 PIN을 지운다. 그 선수는 다음 투표 때 새 PIN을 정한다. */
export const DELETE = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  if (!(await resetPin(id))) throw notFound("선수를 찾을 수 없습니다");
  return noContent();
});
