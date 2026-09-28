/**
 * 예시 데이터 넣기: `npm run db:seed`
 * 선수가 한 명이라도 있으면 아무것도 하지 않는다 (실제 데이터를 덮어쓰지 않도록).
 * 테이블은 먼저 `npm run db:push`로 만들어야 한다.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { matchAttendance, matchGoals, matches, players } from "../src/lib/db/schema";
import type { Position } from "../src/lib/positions";

const SAMPLE_PLAYERS: { name: string; positions: Position[] }[] = [
  { name: "이무성", positions: ["CB", "LB", "CM"] },
  { name: "장상준", positions: ["LW", "ST"] },
  { name: "김도현", positions: ["GK"] },
  { name: "박지훈", positions: ["RB", "RWB", "RM"] },
  { name: "최민재", positions: ["CB", "CDM"] },
  { name: "정우진", positions: ["CDM", "CM"] },
  { name: "한승우", positions: ["CM", "CAM"] },
  { name: "오세훈", positions: ["CAM", "ST"] },
  { name: "강태양", positions: ["RW", "RM", "ST"] },
  { name: "윤현수", positions: ["LB", "LWB", "LM"] },
  { name: "신재원", positions: ["ST", "CAM"] },
  { name: "조민기", positions: ["GK", "CB"] },
  { name: "임동혁", positions: ["CM", "RB"] },
];

/** 오늘 이후 가장 가까운 요일(0=일요일)의 YYYY-MM-DD */
function nextWeekday(weekday: number) {
  const date = new Date();
  const diff = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function main() {
  const existing = await db.select({ id: players.id }).from(players).limit(1);
  if (existing.length > 0) {
    console.log("이미 선수 데이터가 있어 시드를 건너뜁니다.");
    return;
  }

  const playerRows = SAMPLE_PLAYERS.map((player) => ({ id: crypto.randomUUID(), ...player }));
  await db.insert(players).values(playerRows);
  const idOf = (name: string) => playerRows.find((p) => p.name === name)!.id;

  const firstMatch = crypto.randomUUID();
  const secondMatch = crypto.randomUUID();
  const upcomingMatch = crypto.randomUUID();
  await db.insert(matches).values([
    {
      id: firstMatch,
      playedAt: "2026-09-20",
      opponent: "FC 한강",
      ourScore: 3,
      theirScore: 1,
      location: "반포 잔디구장",
      memo: null,
    },
    {
      id: secondMatch,
      playedAt: "2026-09-27",
      opponent: "성수 유나이티드",
      ourScore: 1,
      theirScore: 2,
      location: null,
      memo: "후반 20분 이후 체력이 떨어지면서 실점. 교체 타이밍을 더 빨리 가져가야 할 듯.",
    },
    {
      id: upcomingMatch,
      playedAt: nextWeekday(0),
      opponent: "망원 FC",
      ourScore: null,
      theirScore: null,
      location: "난지 축구장",
      memo: null,
    },
  ]);
  await db.insert(matchGoals).values([
    { id: crypto.randomUUID(), matchId: firstMatch, scorerId: idOf("장상준"), assistId: idOf("한승우"), sortOrder: 0 },
    { id: crypto.randomUUID(), matchId: firstMatch, scorerId: idOf("신재원"), assistId: null, sortOrder: 1 },
    { id: crypto.randomUUID(), matchId: firstMatch, scorerId: idOf("장상준"), assistId: idOf("강태양"), sortOrder: 2 },
    { id: crypto.randomUUID(), matchId: secondMatch, scorerId: idOf("오세훈"), assistId: idOf("이무성"), sortOrder: 0 },
  ]);
  await db.insert(matchAttendance).values([
    { id: crypto.randomUUID(), matchId: upcomingMatch, playerId: idOf("이무성"), status: "yes" },
    { id: crypto.randomUUID(), matchId: upcomingMatch, playerId: idOf("장상준"), status: "yes" },
    { id: crypto.randomUUID(), matchId: upcomingMatch, playerId: idOf("김도현"), status: "maybe" },
    { id: crypto.randomUUID(), matchId: upcomingMatch, playerId: idOf("박지훈"), status: "no" },
  ]);

  console.log(`선수 ${playerRows.length}명, 경기 3개(예정 1개 포함)를 넣었습니다.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
