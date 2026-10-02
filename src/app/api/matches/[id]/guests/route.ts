import { guestInputSchema } from "@/features/attendance/schema";
import { createGuest, listGuests } from "@/server/guests";
import { json, notFound, parseBody, requireAdmin, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listGuests(id));
});

/** 용병 추가는 관리자(주장)만. */
export const POST = withErrorHandling(async (request, { params }: IdContext) => {
  requireAdmin(request);
  const { id } = await params;
  const input = await parseBody(request, guestInputSchema);
  if (!(await getMatch(id))) throw notFound("경기를 찾을 수 없습니다");
  return json(await createGuest(id, input), { status: 201 });
});
