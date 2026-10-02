import { z } from "zod";
import { quarterListSchema } from "@/features/formations/schema";
import { playerPinSchema } from "@/features/players/schema";
import { POSITIONS, type Position } from "@/lib/positions";

/** 선수 본인 확인용 PIN. 관리자는 없이 보낼 수 있어서 선택값이고, 필요 여부는 서버가 판단한다. */
const pin = playerPinSchema.optional();

/** 표시 순서. "maybe"는 DB 값이라 그대로 두고 화면에는 "보류"로 보여 준다. */
export const ATTENDANCE_STATUSES = ["yes", "no", "maybe"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  yes: "참석",
  no: "불참",
  maybe: "보류",
};

/** 상태별 색 톤. 참석은 잔디색, 보류는 amber, 불참은 중립. */
export const ATTENDANCE_TONE: Record<AttendanceStatus, "pitch" | "amber" | "neutral"> = {
  yes: "pitch",
  no: "neutral",
  maybe: "amber",
};

/** 응답은 이름을 고르고, 그 선수의 PIN으로 본인임을 확인한다 (처음이면 그 PIN으로 정해진다). */
export const attendanceInputSchema = z.object({
  playerId: z.string().min(1, "이름을 골라 주세요"),
  status: z.enum(ATTENDANCE_STATUSES),
  /** 참석일 때 뛸 수 있는 쿼터(늦참·조퇴). 없으면 네 쿼터 모두. 불참·보류면 무시한다. */
  quarters: quarterListSchema.nullable().optional(),
  pin,
});

export const attendanceRemoveSchema = z.object({
  playerId: z.string().min(1, "이름을 골라 주세요"),
  pin,
});

export type AttendanceInput = z.infer<typeof attendanceInputSchema>;

export type Attendance = {
  id: string;
  matchId: string;
  playerId: string;
  status: AttendanceStatus;
  /** 뛸 수 있는 쿼터. null = 네 쿼터 모두 */
  quarters: number[] | null;
  /** 투표 마감 뒤에 참석으로 바꾼 사람 */
  lateJoin: boolean;
  updatedAt: string;
};

/** 용병(게스트). 관리자가 넣고 뺀다. 포지션은 자동 배치에 쓰인다. */
export const guestInputSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(20, "이름은 20자까지 가능해요"),
  positions: z
    .array(z.enum(POSITIONS))
    .min(1, "포지션을 하나 이상 골라 주세요")
    .refine((list) => new Set(list).size === list.length, "포지션이 중복됐어요"),
  quarters: quarterListSchema.nullable().optional(),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

export type MatchGuest = {
  id: string;
  matchId: string;
  name: string;
  positions: Position[];
  quarters: number[] | null;
  createdAt: string;
};

/** 투표 아래 댓글. 이름을 밝히고 남긴다 (왜 불참/보류인지 알리는 용도). */
export const commentInputSchema = z.object({
  playerId: z.string().min(1, "이름을 골라 주세요"),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(300, "300자까지 적을 수 있어요"),
  pin,
});

/** 삭제는 관리자이거나, 본인 이름으로 쓴 댓글을 그 선수의 PIN과 함께 요청할 때만. */
export const commentRemoveSchema = z.object({
  playerId: z.string().nullable(),
  pin,
});

export type CommentInput = z.infer<typeof commentInputSchema>;

export type MatchComment = {
  id: string;
  matchId: string;
  playerId: string;
  playerName: string;
  content: string;
  createdAt: string;
};
