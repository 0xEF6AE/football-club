import { z } from "zod";

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

/** 응답은 선수 이름을 고르는 방식(신뢰 기반). 누가 눌렀는지는 따로 확인하지 않는다. */
export const attendanceInputSchema = z.object({
  playerId: z.string().min(1, "이름을 골라 주세요"),
  status: z.enum(ATTENDANCE_STATUSES),
});

export const attendanceRemoveSchema = z.object({
  playerId: z.string().min(1, "이름을 골라 주세요"),
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
});

/** 삭제는 관리자이거나, 본인 이름으로 쓴 댓글일 때만 (신뢰 기반). */
export const commentRemoveSchema = z.object({
  playerId: z.string().nullable(),
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
