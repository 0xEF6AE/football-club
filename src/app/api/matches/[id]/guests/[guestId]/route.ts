import { deleteGuest } from "@/server/guests";
import { noContent, notFound, requireAdmin, withErrorHandling } from "@/server/http";

type Context = { params: Promise<{ id: string; guestId: string }> };

export const DELETE = withErrorHandling(async (request, { params }: Context) => {
  requireAdmin(request);
  const { id, guestId } = await params;
  if (!(await deleteGuest(id, guestId))) throw notFound("용병을 찾을 수 없습니다");
  return noContent();
});
