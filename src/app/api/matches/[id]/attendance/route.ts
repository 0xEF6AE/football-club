import type { NextRequest } from "next/server";
import { attendanceInputSchema, attendanceRemoveSchema } from "@/features/attendance/schema";
import { canJoinLate, isVoteClosed, type Match } from "@/features/matches/schema";
import { isAdminRequest, isProtected } from "@/server/admin";
import { getAttendance, listAttendance, removeAttendance, setAttendance } from "@/server/attendance";
import { HttpError, json, noContent, notFound, parseBody, withErrorHandling, type IdContext } from "@/server/http";
import { getMatch } from "@/server/matches";
import { authorizePlayer } from "@/server/pin";

export const GET = withErrorHandling(async (_request, { params }: IdContext) => {
  const { id } = await params;
  return json(await listAttendance(id));
});

/** 비밀번호가 걸린 배포의 관리자(주장)는 마감·취소와 상관없이 명단을 고칠 수 있다. 로컬(비밀번호 없음)에는 예외가 없다. */
const isAdminOverride = (request: NextRequest) => isProtected() && isAdminRequest(request);

async function loadMatch(matchId: string): Promise<Match> {
  const match = await getMatch(matchId);
  if (!match) throw notFound("경기를 찾을 수 없습니다");
  return match;
}

/**
 * 참석 응답. 그 선수의 PIN이 맞아야 한다 (관리자는 PIN 없이). 같은 선수의 응답은 덮어쓴다.
 * - 마감(따로 정한 시각, 없으면 킥오프) 전: 참석·불참·보류 모두.
 * - 마감 뒤 ~ 킥오프 2시간 뒤: "늦게라도 참석"만 (불참·보류였다가 오게 된 사람). 마감 후 참석으로 표시된다.
 *   이미 참석인 사람은 뛸 수 있는 쿼터(늦참·조퇴)만 바꿀 수 있다. 불참·보류로 바꾸려면 댓글로 알리고 주장이 고친다.
 * - 그 뒤, 결과가 나온 경기, 취소된 경기: 관리자만.
 */
export const PUT = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const { pin, ...input } = await parseBody(request, attendanceInputSchema);
  const match = await loadMatch(id);
  const admin = isAdminOverride(request);
  const closed = isVoteClosed(match);

  if (closed && !admin) {
    if (match.cancelled) throw new HttpError(403, "취소된 경기예요");
    if (!canJoinLate(match)) throw new HttpError(403, "참석 투표가 마감됐어요");
    if (input.status !== "yes") {
      throw new HttpError(403, "마감 뒤에는 불참·보류로 바꿀 수 없어요. 댓글로 사정을 알려 주세요");
    }
  }

  await authorizePlayer(request, input.playerId, pin);
  const previous = await getAttendance(id, input.playerId);
  // 마감 뒤에 참석으로 바뀐 사람은 표시해 둔다. 원래 참석이던 사람이 쿼터만 바꾸면 표시를 그대로 둔다.
  const lateJoin =
    input.status === "yes" && (previous?.status === "yes" ? previous.lateJoin : closed);
  return json(await setAttendance(id, input, lateJoin));
});

export const DELETE = withErrorHandling(async (request, { params }: IdContext) => {
  const { id } = await params;
  const { playerId, pin } = await parseBody(request, attendanceRemoveSchema);
  const match = await loadMatch(id);
  if (isVoteClosed(match) && !isAdminOverride(request)) throw new HttpError(403, "참석 투표가 마감됐어요");
  await authorizePlayer(request, playerId, pin);
  if (!(await removeAttendance(id, playerId))) throw notFound("응답이 없습니다");
  return noContent();
});
