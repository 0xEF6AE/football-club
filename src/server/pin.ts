import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
import { isAdminRequest, isProtected } from "./admin";
import { HttpError, notFound } from "./http";

/**
 * 참석 투표·댓글용 개인 PIN.
 * - 처음 쓸 때 보낸 PIN이 그 선수의 PIN이 된다. 그 뒤로는 같은 PIN이 있어야 그 이름으로 행동할 수 있다.
 * - 4자리라 경우의 수가 1만 개뿐이므로, MAX_FAILURES번 틀리면 LOCK_MINUTES분 잠근다. 잠금은 DB에 남겨
 *   서버리스(요청마다 다른 인스턴스)에서도 유지된다.
 * - 비밀번호가 걸린 배포의 관리자는 PIN 없이 통과한다 (주장이 대신 체크해 주는 용도).
 */
const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 10;
const KEY_LENGTH = 32;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(pin, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 한 번 더 틀렸을 때의 상태. MAX_FAILURES에 닿으면 잠그고 횟수를 0으로 돌린다. */
export function nextFailureState(failedCount: number, now: Date) {
  const count = failedCount + 1;
  if (count >= MAX_FAILURES) {
    return { pinFailedCount: 0, pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() };
  }
  return { pinFailedCount: count, pinLockedUntil: null };
}

const pinError = (status: number, message: string) => new HttpError(status, message, [{ path: "pin", message }]);

/**
 * 요청이 이 선수 이름으로 행동해도 되는지 확인한다. 안 되면 HttpError를 던진다.
 * PIN을 아직 안 정한 선수라면 이번에 보낸 PIN을 그 선수의 PIN으로 정한다.
 */
export async function authorizePlayer(request: NextRequest, playerId: string, pin: string | undefined, now = new Date()) {
  const [row] = await db
    .select({
      pinHash: players.pinHash,
      pinFailedCount: players.pinFailedCount,
      pinLockedUntil: players.pinLockedUntil,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!row) throw notFound("선수를 찾을 수 없습니다");

  if (isProtected() && isAdminRequest(request)) return;

  if (row.pinLockedUntil && new Date(row.pinLockedUntil) > now) {
    const minutes = Math.max(1, Math.ceil((new Date(row.pinLockedUntil).getTime() - now.getTime()) / 60_000));
    throw new HttpError(429, `PIN을 여러 번 틀려 잠겼어요. ${minutes}분 뒤에 다시 해 주세요`);
  }

  if (!pin) throw pinError(401, row.pinHash ? "PIN 4자리를 입력해 주세요" : "PIN 4자리를 정해 주세요");

  if (row.pinHash === null) {
    // 처음 정하는 경우. 동시에 두 요청이 정하려 하면 먼저 저장된 쪽이 이기고, 나중 요청은 그 PIN으로 검사한다.
    const set = await db
      .update(players)
      .set({ pinHash: await hashPin(pin), pinFailedCount: 0, pinLockedUntil: null })
      .where(and(eq(players.id, playerId), isNull(players.pinHash)))
      .returning({ id: players.id });
    if (set.length > 0) return;
    return authorizePlayer(request, playerId, pin, now);
  }

  const failedCount = row.pinFailedCount ?? 0;
  if (await verifyPin(pin, row.pinHash)) {
    if (failedCount > 0 || row.pinLockedUntil) {
      await db.update(players).set({ pinFailedCount: 0, pinLockedUntil: null }).where(eq(players.id, playerId));
    }
    return;
  }

  const next = nextFailureState(failedCount, now);
  await db.update(players).set(next).where(eq(players.id, playerId));
  if (next.pinLockedUntil) {
    throw new HttpError(429, `PIN을 ${MAX_FAILURES}번 틀려 ${LOCK_MINUTES}분 동안 잠겼어요`);
  }
  throw pinError(401, `PIN이 맞지 않아요 (${MAX_FAILURES - next.pinFailedCount}번 더 틀리면 잠겨요)`);
}

/** 관리자용: PIN을 지운다. 그 선수는 다음 투표 때 새 PIN을 정한다. */
export async function resetPin(playerId: string): Promise<boolean> {
  const rows = await db
    .update(players)
    .set({ pinHash: null, pinFailedCount: 0, pinLockedUntil: null })
    .where(eq(players.id, playerId))
    .returning({ id: players.id });
  return rows.length > 0;
}
