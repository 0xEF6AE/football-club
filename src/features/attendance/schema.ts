import { z } from "zod";
import { playerPinSchema } from "@/features/players/schema";

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
  updatedAt: string;
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
