import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as attendanceRoute from "@/app/api/matches/[id]/attendance/route";
import * as commentRoute from "@/app/api/matches/[id]/comments/[commentId]/route";
import * as commentsRoute from "@/app/api/matches/[id]/comments/route";
import * as playersRoute from "@/app/api/players/route";
import type { Match } from "@/features/matches/schema";
import type { Player } from "@/features/players/schema";
import { MAX_FAILURES } from "@/server/pin";
import { adminHeaders, context, protectWrites, request, seedPlayer, seedUpcomingMatch } from "./helpers";

/** "그 선수 본인만 자기 이름으로 투표·댓글" 규칙 (개인 PIN 4자리) */
let match: Match;
let me: Player;
let other: Player;

beforeAll(async () => {
  match = await seedUpcomingMatch();
  me = await seedPlayer("이무성");
  other = await seedPlayer("장상준");
});

beforeEach(() => protectWrites());

const vote = (playerId: string, pin?: string, headers?: Record<string, string>) =>
  attendanceRoute.PUT(
    request("PUT", `/api/matches/${match.id}/attendance`, { body: { playerId, status: "yes", pin }, headers }),
    context({ id: match.id }),
  );

describe("참석 투표 PIN", () => {
  it("PIN 없이는 투표할 수 없다", async () => {
    const response = await vote(me.id);
    expect(response.status).toBe(401);
    expect((await response.json()).issues[0].path).toBe("pin");
  });

  it("처음 보낸 PIN이 그 선수의 PIN이 되고, 이후에는 같은 PIN만 통과한다", async () => {
    expect((await vote(me.id, "1234")).status).toBe(200);
    expect((await vote(me.id, "9999")).status).toBe(401);
    expect((await vote(me.id, "1234")).status).toBe(200);
  });

  it("다른 사람이 내 이름으로 투표하려면 내 PIN이 필요하다 (자기 PIN으로는 안 된다)", async () => {
    expect((await vote(other.id, "5555")).status).toBe(200); // other가 자기 PIN을 정함
    expect((await vote(me.id, "5555")).status).toBe(401); // other의 PIN으로 내 이름 투표 시도
  });

  it(`${MAX_FAILURES}번 틀리면 맞는 PIN도 잠시 막힌다`, async () => {
    const victim = await seedPlayer("잠금테스트");
    expect((await vote(victim.id, "4321")).status).toBe(200);
    const statuses = [];
    for (let i = 0; i < MAX_FAILURES; i++) statuses.push((await vote(victim.id, "0000")).status);
    expect(statuses.at(-1)).toBe(429);
    expect((await vote(victim.id, "4321")).status).toBe(429);
  });

  it("관리자는 PIN 없이 누구의 응답이든 고칠 수 있다", async () => {
    expect((await vote(me.id, undefined, adminHeaders())).status).toBe(200);
  });

  it("선수 목록 API에는 PIN 해시가 절대 나오지 않는다", async () => {
    const body = await (await playersRoute.GET(request("GET", "/api/players"), context({}))).text();
    expect(body).not.toMatch(/pinHash|pin_hash|scrypt/i);
    expect(JSON.parse(body).find((p: Player) => p.id === me.id).hasPin).toBe(true);
  });
});

describe("투표 댓글 PIN", () => {
  const comment = (playerId: string, pin?: string) =>
    commentsRoute.POST(
      request("POST", `/api/matches/${match.id}/comments`, { body: { playerId, content: "불참이요", pin } }),
      context({ id: match.id }),
    );

  it("틀린 PIN으로는 남의 이름으로 댓글을 쓸 수 없다", async () => {
    expect((await comment(me.id, "0000")).status).toBe(401);
  });

  it("본인만 지울 수 있다: 남의 이름 403, 본인이라도 틀린 PIN 401, 맞는 PIN 204", async () => {
    const created = await (await comment(me.id, "1234")).json();
    const remove = (playerId: string, pin?: string) =>
      commentRoute.DELETE(
        request("DELETE", `/api/matches/${match.id}/comments/${created.id}`, { body: { playerId, pin } }),
        context({ id: match.id, commentId: created.id }),
      );
    expect((await remove(other.id, "5555")).status).toBe(403);
    expect((await remove(me.id, "0000")).status).toBe(401);
    expect((await remove(me.id, "1234")).status).toBe(204);
  });
});
