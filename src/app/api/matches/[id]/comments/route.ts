import { commentInputSchema } from "@/features/attendance/schema";
import { createComment, listComments } from "@/server/comments";
import { json, notFound, parseBody, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";
import { getPlayer } from "@/server/players";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listComments(id));
});

/** 댓글은 모임원 누구나, 투표 마감 뒤에도 남길 수 있다 (마감 뒤 사정 변경을 알리는 용도). */
export const POST = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const input = await parseBody(request, commentInputSchema);
  if (!(await getMatch(id))) throw notFound("경기를 찾을 수 없습니다");
  if (!(await getPlayer(input.playerId))) throw notFound("선수를 찾을 수 없습니다");
  return json(await createComment(id, input), { status: 201 });
});
