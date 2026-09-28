import { z } from "zod";
import type { Position } from "@/lib/positions";

export const FORMATION_SHAPES = ["4-2-3-1", "4-1-2-3", "4-3-3", "4-4-2", "3-5-2"] as const;
export type FormationShape = (typeof FORMATION_SHAPES)[number];

/** 한 경기는 1~4쿼터로 나뉘고, 쿼터마다 라인업을 따로 짠다. */
export const QUARTER_COUNT = 4;
export const QUARTER_INDEXES = [0, 1, 2, 3] as const;

export const quarterLabel = (index: number) => `${index + 1}쿼터`;

export type FormationSlot = {
  /** 포메이션 안에서 고유. 다른 포메이션과 같은 id면(cb1 등) 전환 시 선수를 이어받는다. */
  id: string;
  position: Position;
  /** 피치 좌표(%). x: 왼쪽→오른쪽, y: 상대 골문(0)→우리 골문(100) */
  x: number;
  y: number;
  /** 텍스트 요약에서 같은 줄로 묶이는 라인 번호 (0 = GK) */
  row: number;
};

/** slotId → playerId | null */
export type LineupAssignments = Record<string, string | null>;

/** 쿼터 하나의 라인업 */
export type QuarterLineup = {
  shape: FormationShape;
  assignments: LineupAssignments;
};

export const quarterLineupSchema = z
  .object({
    shape: z.enum(FORMATION_SHAPES),
    assignments: z.record(z.string(), z.string().nullable()),
  })
  .refine(
    ({ assignments }) => {
      const ids = Object.values(assignments).filter((id): id is string => id !== null);
      return new Set(ids).size === ids.length;
    },
    { message: "같은 선수가 두 자리에 배치돼 있어요", path: ["assignments"] },
  );

export const formationInputSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(30, "이름은 30자까지 가능해요"),
  attendingIds: z.array(z.string()).max(60),
  quarters: z.array(quarterLineupSchema).length(QUARTER_COUNT, "쿼터 4개를 모두 보내 주세요"),
});

export type FormationInput = z.infer<typeof formationInputSchema>;

export type SavedFormation = FormationInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/** 쿼터 모양을 한 줄로: 전부 같으면 "4-2-3-1", 다르면 "4-2-3-1 · 4-4-2" (등장 순서, 중복 제거) */
export function summarizeShapes(shapes: readonly FormationShape[]): string {
  return [...new Set(shapes)].join(" · ");
}
