import type { NextRequest } from "next/server";
import { attendanceInputSchema, attendanceRemoveSchema } from "@/features/attendance/schema";
import { isVoteClosed } from "@/features/matches/schema";
import { isAdminRequest, isProtected } from "@/server/admin";
import { listAttendance, removeAttendance, setAttendance } from "@/server/attendance";
import { HttpError, json, noContent, notFound, parseBody, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";
import { authorizePlayer } from "@/server/pin";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listAttendance(id));
});

/**
 * 마감 시각이 지나면 응답을 바꿀 수 없다.
 * 비밀번호가 설정된 배포에서는 관리자(주장)가 마감 뒤에도 명단을 고칠 수 있게 예외를 둔다.
 * 비밀번호가 없는 로컬에서는 누구나 관리자로 취급되므로 예외 없이 모두에게 마감을 적용한다.
 */
async function assertVoteOpen(request: NextRequest, matchId: string) {
  const match = await getMatch(matchId);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  const adminOverride = isProtected() && isAdminRequest(request);
  if (isVoteClosed(match) && !adminOverride) throw new HttpError(403, "참석 투표가 마감됐어요");
}

/** 참석 응답. 그 선수의 PIN이 맞아야 한다 (관리자는 PIN 없이). 같은 선수의 응답은 덮어쓴다. */
export const PUT = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const { pin, ...input } = await parseBody(request, attendanceInputSchema);
  await assertVoteOpen(request, id);
  await authorizePlayer(request, input.playerId, pin);
  return json(await setAttendance(id, input));
});

export const DELETE = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const { playerId, pin } = await parseBody(request, attendanceRemoveSchema);
  await assertVoteOpen(request, id);
  await authorizePlayer(request, playerId, pin);
  if (!(await removeAttendance(id, playerId))) throw notFound("응답이 없습니다");
  return noContent();
});
