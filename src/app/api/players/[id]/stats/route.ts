import { json, notFound, withErrorHandling, type IdContext } from "@/server/http";
import { getPlayerStats } from "@/server/players";

/** 선수 개인 기록. 읽기 전용이라 누구나 볼 수 있다. */
export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  const stats = await getPlayerStats(id);
  if (!stats) throw notFound("선수를 찾을 수 없습니다");
  return json(stats);
});
