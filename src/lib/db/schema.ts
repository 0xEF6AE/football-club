import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Position } from "@/lib/positions";
import type { AttendanceStatus } from "@/features/attendance/schema";
import type { FeedbackCategory } from "@/features/feedback/schema";
import type { FormationGuest, PlayerAvailability, QuarterLineup } from "@/features/formations/schema";

/**
 * 타임스탬프는 ISO 문자열로 저장한다.
 * - JSON 응답에서 변환 없이 그대로 쓰이고, 문자열 정렬 = 시간 정렬이 성립한다.
 */
const isoTimestamp = (name: string) =>
  text(name)
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** 가능한 포지션 목록. 앞에 올수록 선호(주 포지션). */
  positions: text("positions", { mode: "json" }).$type<Position[]>().notNull(),
  /**
   * 참석 투표·댓글용 개인 PIN(숫자 4자리)의 scrypt 해시. null이면 아직 안 정함.
   * API 응답에는 절대 싣지 않는다 (server/players.ts의 toPlayer가 hasPin만 내보낸다).
   */
  pinHash: text("pin_hash"),
  /**
   * 연속으로 틀린 횟수. 맞히면 0으로. null은 0으로 본다.
   * (NOT NULL로 두면 drizzle-kit이 기존 선수 행이 있는 테이블에 열을 추가할 때 데이터 손실 경고를 내서 nullable로 둔다.)
   */
  pinFailedCount: integer("pin_failed_count").default(0),
  /** 여러 번 틀려 잠긴 경우 풀리는 시각(ISO). */
  pinLockedUntil: text("pin_locked_until"),
  createdAt: isoTimestamp("created_at"),
});

export const formations = sqliteTable("formations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** 이 라인업을 짤 때 참석으로 체크한 선수 id 목록 (벤치 복원용). 네 쿼터가 공유한다. */
  attendingIds: text("attending_ids", { mode: "json" }).$type<string[]>().notNull(),
  /** 1~4쿼터 라인업. 쿼터마다 모양(shape)과 slotId → playerId | null 배치가 있다. */
  quarters: text("quarters", { mode: "json" }).$type<QuarterLineup[]>().notNull(),
  /** 이 라인업에 넣은 용병(그날만 뛴 사람). 이름을 다시 그리려고 함께 저장한다. null = 없음 */
  guests: text("guests", { mode: "json" }).$type<FormationGuest[]>(),
  /** 선수별 뛸 수 있는 쿼터(늦참·조퇴). 없는 선수는 네 쿼터 모두. null = 모두 */
  availability: text("availability", { mode: "json" }).$type<PlayerAvailability>(),
  createdAt: isoTimestamp("created_at"),
  updatedAt: isoTimestamp("updated_at"),
});

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    /** YYYY-MM-DD */
    playedAt: text("played_at").notNull(),
    /** 킥오프 시각 "HH:mm" (24시간). null이면 시간 미정. */
    kickoffTime: text("kickoff_time"),
    opponent: text("opponent").notNull(),
    /** 둘 다 null이면 아직 안 한 경기(예정). 둘 다 있으면 결과가 기록된 경기. */
    ourScore: integer("our_score"),
    theirScore: integer("their_score"),
    location: text("location"),
    memo: text("memo"),
    /** 참석 투표 마감 시각(ISO). null이면 킥오프 시각(미정이면 경기 당일 0시)에 마감. */
    voteDeadline: text("vote_deadline"),
    /**
     * 추가 모집 마감(ISO). 투표 마감 뒤 주장이 보류·불참·미투표에게 다시 물을 때, 언제까지 "늦게라도 참석"을 받을지.
     * null이면 킥오프 2시간 뒤까지.
     */
    lateJoinDeadline: text("late_join_deadline"),
    /** 그날 사용한(저장된) 포메이션. 포메이션이 지워지면 null. */
    formationId: text("formation_id").references(() => formations.id, { onDelete: "set null" }),
    /** 우천·인원 부족 등으로 취소된 경기. null/false = 아님. 결과를 입력하면 풀린다. */
    cancelled: integer("cancelled", { mode: "boolean" }),
    cancelReason: text("cancel_reason"),
    createdAt: isoTimestamp("created_at"),
  },
  (t) => [index("matches_played_at_idx").on(t.playedAt)],
);

export const matchGoals = sqliteTable(
  "match_goals",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    /** null = 득점자 미상(자책골 등) */
    scorerId: text("scorer_id").references(() => players.id, { onDelete: "set null" }),
    assistId: text("assist_id").references(() => players.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("match_goals_match_id_idx").on(t.matchId)],
);

/** 경기별 참석 응답. 선수 한 명당 경기 하나에 응답 하나. */
export const matchAttendance = sqliteTable(
  "match_attendance",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    status: text("status").$type<AttendanceStatus>().notNull(),
    /** 참석일 때 뛸 수 있는 쿼터(0~3, 늦참·조퇴). null = 네 쿼터 모두 */
    quarters: text("quarters", { mode: "json" }).$type<number[]>(),
    /** 투표 마감 뒤에 참석으로 바꾼 사람 (불참·보류였다가 오게 된 경우 등) */
    lateJoin: integer("late_join", { mode: "boolean" }),
    updatedAt: isoTimestamp("updated_at"),
  },
  (t) => [uniqueIndex("match_attendance_match_player_idx").on(t.matchId, t.playerId)],
);

/** 용병(게스트): 선수로 등록하지 않고 그 경기에만 오는 사람. 관리자가 넣고 뺀다. 기록(득점왕 등)에는 들어가지 않는다. */
export const matchGuests = sqliteTable(
  "match_guests",
  {
    /** "guest-" + uuid. 라인업에서 선수 id와 섞여 쓰이므로 접두사로 구별한다. */
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    positions: text("positions", { mode: "json" }).$type<Position[]>().notNull(),
    /** 뛸 수 있는 쿼터. null = 네 쿼터 모두 */
    quarters: text("quarters", { mode: "json" }).$type<number[]>(),
    createdAt: isoTimestamp("created_at"),
  },
  (t) => [index("match_guests_match_id_idx").on(t.matchId)],
);

/**
 * 참석 투표 아래 댓글. "왜 불참인지, 왜 보류인지"를 적는 용도라 작성자(선수)를 밝힌다.
 * 익명 피드백(feedbacks)과는 성격이 달라 익명이 아니다. 투표 마감 뒤에도 남길 수 있다.
 */
export const matchComments = sqliteTable(
  "match_comments",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: isoTimestamp("created_at"),
  },
  (t) => [index("match_comments_match_id_idx").on(t.matchId)],
);

export const feedbacks = sqliteTable(
  "feedbacks",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    category: text("category").$type<FeedbackCategory>().notNull(),
    content: text("content").notNull(),
    /** 익명 보장을 위해 작성자 관련 정보는 어떤 형태로도 저장하지 않는다. */
    createdAt: isoTimestamp("created_at"),
  },
  (t) => [index("feedbacks_match_id_idx").on(t.matchId)],
);
