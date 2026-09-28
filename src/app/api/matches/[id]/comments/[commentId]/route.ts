import { commentRemoveSchema } from "@/features/attendance/schema";
import { isAdminRequest } from "@/server/admin";
import { deleteComment, getComment } from "@/server/comments";
import { HttpError, noContent, notFound, parseBody, withErrorHandling } from "@/server/http";

type Context = { params: Promise<{ id: string; commentId: string }> };

/** 관리자이거나, 본문의 playerId가 댓글 작성자와 같을 때만 지운다 (투표와 같은 신뢰 기반). */
export const DELETE = withErrorHandling(async (request, { params }: Context) => {
  const { id, commentId } = await params;
  const { playerId } = await parseBody(request, commentRemoveSchema);
  const comment = await getComment(id, commentId);
  if (!comment) throw notFound("댓글을 찾을 수 없습니다");
  if (!isAdminRequest(request) && (playerId === null || playerId !== comment.playerId)) {
    throw new HttpError(403, "내 이름으로 쓴 댓글만 지울 수 있어요");
  }
  if (!(await deleteComment(id, commentId))) throw notFound("댓글을 찾을 수 없습니다");
  return noContent();
});
