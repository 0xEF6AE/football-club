import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceRoute from "@/app/api/matches/[id]/attendance/route";
import * as cancelRoute from "@/app/api/matches/[id]/cancel/route";
import * as guestRoute from "@/app/api/matches/[id]/guests/[guestId]/route";
import * as guestsRoute from "@/app/api/matches/[id]/guests/route";
import * as lateJoinRoute from "@/app/api/matches/[id]/late-join/route";
import * as matchRoute from "@/app/api/matches/[id]/route";
import * as matchesRoute from "@/app/api/matches/route";
import * as formationsRoute from "@/app/api/formations/route";
import type { Match } from "@/features/matches/schema";
import { adminHeaders, context, kstDate, protectWrites, request, seedPlayer, seedPlayedMatch, seedUpcomingMatch } from "./helpers";

beforeEach(() => {
  protectWrites();
  vi.spyOn(console, "error").mockImplementation((...args) => {
    throw new Error(`예상 못 한 서버 오류: ${args.join(" ")}`);
  });
});

const vote = (matchId: string, body: Record<string, unknown>, headers?: Record<string, string>) =>
  attendanceRoute.PUT(request("PUT", `/api/matches/${matchId}/attendance`, { body, headers }), context({ id: matchId }));

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
/** 한국 시각 HH:00 (지금 기준 h시간 뒤, 정각으로 내림) */
const kickoffInHours = (h: number) => {
  const kst = new Date(Date.now() + (9 + h) * 3_600_000);
  return { playedAt: kst.toISOString().slice(0, 10), kickoffTime: `${String(kst.getUTCHours()).padStart(2, "0")}:00` };
};

describe("참석 투표 마감", () => {
  it("결과가 나온 경기는 마감 시각을 안 정했어도 투표할 수 없다 (관리자는 가능)", async () => {
    const match = await seedPlayedMatch();
    const player = await seedPlayer("투표자1");
    expect((await vote(match.id, { playerId: player.id, status: "yes", pin: "1111" })).status).toBe(403);
    expect((await vote(match.id, { playerId: player.id, status: "yes" }, adminHeaders())).status).toBe(200);
  });

  it("마감 뒤에는 '늦게라도 참석'만: 참석은 마감 후로 표시, 불참·보류는 거절", async () => {
    const match = await seedUpcomingMatch({ ...kickoffInHours(10), voteDeadline: hoursFromNow(-1) });
    const latecomer = await seedPlayer("늦게오는사람");
    const dropper = await seedPlayer("빠지려는사람");

    const late = await vote(match.id, { playerId: latecomer.id, status: "yes", pin: "2222" });
    expect(late.status).toBe(200);
    expect(await late.json()).toMatchObject({ status: "yes", lateJoin: true });

    expect((await vote(match.id, { playerId: dropper.id, status: "no", pin: "3333" })).status).toBe(403);
    expect((await vote(match.id, { playerId: dropper.id, status: "maybe", pin: "3333" })).status).toBe(403);
  });

  it("마감 전에 참석한 사람은 마감 뒤 쿼터(늦참·조퇴)만 바꿀 수 있고 '마감 후' 표시가 붙지 않는다", async () => {
    const match = await seedUpcomingMatch({ ...kickoffInHours(10), voteDeadline: hoursFromNow(1) });
    const player = await seedPlayer("미리참석");
    expect((await vote(match.id, { playerId: player.id, status: "yes", pin: "4444" })).status).toBe(200);

    // 마감을 지난 것으로 바꾼다 (관리자 수정)
    const { updateMatch } = await import("@/server/matches");
    const current = (await (await matchRoute.GET(request("GET", `/api/matches/${match.id}`), context({ id: match.id }))).json()) as Match;
    await updateMatch(match.id, { ...current, voteDeadline: hoursFromNow(-1), goals: [] });

    const changed = await vote(match.id, { playerId: player.id, status: "yes", quarters: [1, 2, 3], pin: "4444" });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ quarters: [1, 2, 3], lateJoin: false });
  });

  it("킥오프 2시간이 지나면 '늦게라도 참석'도 닫힌다", async () => {
    const match = await seedUpcomingMatch({ ...kickoffInHours(-3), voteDeadline: null });
    const player = await seedPlayer("너무늦음");
    expect((await vote(match.id, { playerId: player.id, status: "yes", pin: "5555" })).status).toBe(403);
  });

  it("뛸 수 있는 쿼터는 참석일 때만 저장되고, 네 쿼터 전부면 '제한 없음(null)'이 된다", async () => {
    const match = await seedUpcomingMatch();
    const player = await seedPlayer("쿼터");
    const all = await vote(match.id, { playerId: player.id, status: "yes", quarters: [3, 0, 1, 2], pin: "6666" });
    expect((await all.json()).quarters).toBeNull();
    const no = await vote(match.id, { playerId: player.id, status: "no", quarters: [0], pin: "6666" });
    expect((await no.json()).quarters).toBeNull();
  });
});

describe("추가 모집 (마감 뒤 다시 묻기)", () => {
  const setLate = (matchId: string, deadline: string | null) =>
    lateJoinRoute.PUT(
      request("PUT", `/api/matches/${matchId}/late-join`, { body: { deadline }, headers: adminHeaders() }),
      context({ id: matchId }),
    );

  it("주장이 정한 추가 모집 마감까지만 '늦게라도 참석'을 받는다", async () => {
    const match = await seedUpcomingMatch({ ...kickoffInHours(10), voteDeadline: hoursFromNow(-2) });
    const first = await seedPlayer("1차응답");
    const second = await seedPlayer("2차응답");
    expect((await setLate(match.id, hoursFromNow(1))).status).toBe(200);
    expect((await vote(match.id, { playerId: first.id, status: "yes", pin: "8888" })).status).toBe(200);

    expect((await setLate(match.id, hoursFromNow(-1) )).status).toBe(200); // 지난 시각(투표 마감 뒤)으로 바꿔 닫는다
    expect((await vote(match.id, { playerId: second.id, status: "yes", pin: "9999" })).status).toBe(403);
  });

  it("추가 모집 마감은 투표 마감 뒤, 킥오프 2시간 뒤 전이어야 한다", async () => {
    const match = await seedUpcomingMatch({ ...kickoffInHours(10), voteDeadline: hoursFromNow(-2) });
    expect((await setLate(match.id, hoursFromNow(-3))).status).toBe(400); // 투표 마감보다 앞
    expect((await setLate(match.id, hoursFromNow(13))).status).toBe(400); // 킥오프 2시간 뒤보다 뒤
    const reset = await setLate(match.id, null);
    expect(await reset.json()).toMatchObject({ lateJoinDeadline: null });
  });
});

describe("경기 취소", () => {
  const cancel = (matchId: string, body: unknown) =>
    cancelRoute.POST(request("POST", `/api/matches/${matchId}/cancel`, { body, headers: adminHeaders() }), context({ id: matchId }));

  it("취소하면 투표가 막히고, 되돌리면 다시 열린다", async () => {
    const match = await seedUpcomingMatch();
    const player = await seedPlayer("우천");
    const res = await cancel(match.id, { cancelled: true, reason: "우천" });
    expect(await res.json()).toMatchObject({ cancelled: true, cancelReason: "우천" });
    expect((await vote(match.id, { playerId: player.id, status: "yes", pin: "7777" })).status).toBe(403);

    await cancel(match.id, { cancelled: false, reason: null });
    expect((await vote(match.id, { playerId: player.id, status: "yes", pin: "7777" })).status).toBe(200);
  });

  it("결과가 있는 경기는 취소할 수 없다", async () => {
    const match = await seedPlayedMatch();
    expect((await cancel(match.id, { cancelled: true, reason: null })).status).toBe(400);
  });

  it("취소한 경기에 결과를 입력하면 취소가 풀린다", async () => {
    const match = await seedUpcomingMatch({ playedAt: kstDate(1) });
    await cancel(match.id, { cancelled: true, reason: "인원 부족" });
    const body = { ...match, ourScore: 1, theirScore: 0, goals: [] };
    const res = await matchRoute.PATCH(
      request("PATCH", `/api/matches/${match.id}`, { body, headers: adminHeaders() }),
      context({ id: match.id }),
    );
    expect(await res.json()).toMatchObject({ cancelled: false, cancelReason: null, ourScore: 1 });
  });
});

describe("득점 기록 검사", () => {
  it("점수보다 득점 기록이 많으면 400", async () => {
    const scorer = await seedPlayer("득점자");
    const goal = { scorerId: scorer.id, assistId: null };
    const body = {
      playedAt: kstDate(1), kickoffTime: null, opponent: "검사 FC", ourScore: 1, theirScore: 0,
      location: null, memo: null, voteDeadline: null, formationId: null, goals: [goal, goal, goal],
    };
    const res = await matchesRoute.POST(request("POST", "/api/matches", { body, headers: adminHeaders() }), context({}));
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0].path).toBe("goals");
  });
});

describe("용병", () => {
  it("관리자가 넣고 빼며, id는 guest-로 시작한다", async () => {
    const match = await seedUpcomingMatch();
    const created = await guestsRoute.POST(
      request("POST", `/api/matches/${match.id}/guests`, {
        body: { name: "홍길동", positions: ["ST"], quarters: [2, 3] },
        headers: adminHeaders(),
      }),
      context({ id: match.id }),
    );
    expect(created.status).toBe(201);
    const guest = await created.json();
    expect(guest).toMatchObject({ name: "홍길동", positions: ["ST"], quarters: [2, 3] });
    expect(guest.id.startsWith("guest-")).toBe(true);

    const list = await (await guestsRoute.GET(request("GET", `/api/matches/${match.id}/guests`), context({ id: match.id }))).json();
    expect(list).toHaveLength(1);

    const removed = await guestRoute.DELETE(
      request("DELETE", `/api/matches/${match.id}/guests/${guest.id}`, { headers: adminHeaders() }),
      context({ id: match.id, guestId: guest.id }),
    );
    expect(removed.status).toBe(204);
  });

  it("포메이션에 용병과 늦참 정보를 함께 저장하고 그대로 돌려준다", async () => {
    const quarter = { shape: "4-2-3-1", assignments: { st1: "guest-abc" } };
    const body = {
      name: "용병 라인업",
      attendingIds: ["guest-abc"],
      quarters: [quarter, quarter, quarter, quarter],
      guests: [{ id: "guest-abc", name: "홍길동", positions: ["ST"] }],
      availability: { "guest-abc": [0, 1] },
    };
    const res = await formationsRoute.POST(request("POST", "/api/formations", { body, headers: adminHeaders() }), context({}));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ guests: body.guests, availability: body.availability });
  });
});
