import { cancelInputSchema, isPlayed } from "@/features/matches/schema";
import { HttpError, json, notFound, parseBody, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch, setMatchCancelled } from "@/server/matches";

/** 경기 취소(우천·인원 부족 등) 또는 되돌리기. 관리자만. 결과가 있는 경기는 취소할 수 없다. */
export const POST = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  const { cancelled, reason } = await parseBody(request, cancelInputSchema);
  const match = await getMatch(id);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  if (cancelled && isPlayed(match)) throw new HttpError(400, "결과가 기록된 경기는 취소할 수 없어요");
  return json(await setMatchCancelled(id, cancelled, reason));
});
