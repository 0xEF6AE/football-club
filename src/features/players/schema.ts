import { z } from "zod";
import { POSITIONS, type Position } from "@/lib/positions";

/** 클라이언트 폼과 서버 Route Handler가 같은 스키마로 검증한다. */
export const playerInputSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(20, "이름은 20자까지 가능해요"),
  positions: z
    .array(z.enum(POSITIONS))
    .min(1, "가능한 포지션을 하나 이상 골라 주세요")
    .refine((list) => new Set(list).size === list.length, "포지션이 중복됐어요"),
});

export type PlayerInput = z.infer<typeof playerInputSchema>;

/**
 * 참석 투표·댓글을 "그 사람만" 할 수 있게 하는 개인 PIN. 숫자 4자리.
 * 처음 쓸 때 정하고, 그 뒤로는 같은 PIN이 있어야 그 이름으로 응답을 바꾸거나 댓글을 쓸 수 있다.
 */
export const PIN_PATTERN = /^\d{4}$/;
export const playerPinSchema = z.string().regex(PIN_PATTERN, "PIN은 숫자 4자리예요");

export type Player = {
  id: string;
  name: string;
  /** 앞에 올수록 선호 포지션 */
  positions: Position[];
  /** 개인 PIN을 정했는지. PIN 자체(해시 포함)는 절대 내려보내지 않는다. */
  hasPin: boolean;
  createdAt: string;
};
