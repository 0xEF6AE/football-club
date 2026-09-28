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

export type Player = {
  id: string;
  name: string;
  /** 앞에 올수록 선호 포지션 */
  positions: Position[];
  createdAt: string;
};
