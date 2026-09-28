import { commentInputSchema } from "@/features/attendance/schema";
import { createComment, listComments } from "@/server/comments";
import { json, notFound, parseBody, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";
import { authorizePlayer } from "@/server/pin";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listComments(id));
});

/**
 * 댓글은 투표 마감 뒤에도 남길 수 있다 (마감 뒤 사정 변경을 알리는 용도).
 * 이름을 밝히는 글이라 그 선수의 PIN이 맞아야 한다 (관리자는 PIN 없이).
 */
export const POST = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const { pin, ...input } = await parseBody(request, commentInputSchema);
  if (!(await getMatch(id))) throw notFound("경기를 찾을 수 없습니다");
  await authorizePlayer(request, input.playerId, pin);
  return json(await createComment(id, input), { status: 201 });
});
