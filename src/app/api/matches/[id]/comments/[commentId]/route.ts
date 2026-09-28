import { commentRemoveSchema } from "@/features/attendance/schema";
import { isAdminRequest, isProtected } from "@/server/admin";
import { deleteComment, getComment } from "@/server/comments";
import { HttpError, noContent, notFound, parseBody, withErrorHandling } from "@/server/http";
import { authorizePlayer } from "@/server/pin";

type Context = { params: Promise<{ id: string; commentId: string }> };

/** 관리자이거나, 댓글 작성자 본인(그 선수의 PIN 확인)일 때만 지운다. */
export const DELETE = withErrorHandling(async (request, { params }: Context) => {
  const { id, commentId } = await params;
  const { playerId, pin } = await parseBody(request, commentRemoveSchema);
  const comment = await getComment(id, commentId);
  if (!comment) throw notFound("댓글을 찾을 수 없습니다");

  const admin = isProtected() && isAdminRequest(request);
  if (!admin) {
    if (playerId === null || playerId !== comment.playerId) {
      throw new HttpError(403, "내 이름으로 쓴 댓글만 지울 수 있어요");
    }
    await authorizePlayer(request, playerId, pin);
  }

  if (!(await deleteComment(id, commentId))) throw notFound("댓글을 찾을 수 없습니다");
  return noContent();
});
