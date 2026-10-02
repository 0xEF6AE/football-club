import { z } from "zod";
import type { Player } from "@/features/players/schema";
import { POSITIONS, type Position } from "@/lib/positions";

export const FORMATION_SHAPES = ["4-2-3-1", "4-1-2-3", "4-3-3", "4-4-2", "3-5-2"] as const;
export type FormationShape = (typeof FORMATION_SHAPES)[number];

/** 한 경기는 1~4쿼터로 나뉘고, 쿼터마다 라인업을 따로 짠다. */
export const QUARTER_COUNT = 4;
export const QUARTER_INDEXES = [0, 1, 2, 3] as const;

export const quarterLabel = (index: number) => `${index + 1}쿼터`;

/** 뛸 수 있는 쿼터 목록(0~3). 늦참·조퇴를 나타낸다. 중복 없이 하나 이상. */
export const quarterListSchema = z
  .array(z.number().int().min(0).max(QUARTER_COUNT - 1))
  .min(1, "뛸 수 있는 쿼터를 하나 이상 골라 주세요")
  .max(QUARTER_COUNT)
  .refine((list) => new Set(list).size === list.length, "쿼터가 중복됐어요");

/** 정렬·중복 제거하고, 네 쿼터 전부면 null(= 제한 없음)로 줄인다. 저장 전에 쓴다. */
export function normalizeQuarterList(list: readonly number[] | null | undefined): number[] | null {
  if (!list) return null;
  const sorted = [...new Set(list)].filter((q) => q >= 0 && q < QUARTER_COUNT).sort((a, b) => a - b);
  return sorted.length === 0 || sorted.length === QUARTER_COUNT ? null : sorted;
}

/** null이면 모두 가능 */
export function canPlayQuarter(list: readonly number[] | null | undefined, quarter: number): boolean {
  return !list || list.includes(quarter);
}

/**
 * 짧은 표시: [1,2,3] → "2Q부터", [0,1] → "2Q까지", [0,2] → "1·3Q", null/전부 → "".
 * (늦게 오는 사람, 일찍 가는 사람, 중간에 빠지는 사람)
 */
export function formatQuarters(list: readonly number[] | null | undefined): string {
  const q = normalizeQuarterList(list);
  if (!q) return "";
  const contiguous = q.every((v, i) => i === 0 || v === q[i - 1] + 1);
  if (contiguous && q.at(-1) === QUARTER_COUNT - 1) return `${q[0] + 1}Q부터`;
  if (contiguous && q[0] === 0) return `${q.at(-1)! + 1}Q까지`;
  return `${q.map((v) => v + 1).join("·")}Q`;
}

/** 용병(게스트) id는 "guest-"로 시작한다. 선수 id와 같은 자리에 섞여 쓰인다. */
export const GUEST_ID_PREFIX = "guest-";
export const isGuestId = (id: string) => id.startsWith(GUEST_ID_PREFIX);

/** 라인업에 넣은 용병. 포메이션에 함께 저장돼 나중에 다시 그릴 수 있다. */
export const formationGuestSchema = z.object({
  id: z.string().startsWith(GUEST_ID_PREFIX),
  name: z.string().trim().min(1).max(20),
  positions: z.array(z.enum(POSITIONS)).min(1),
});
export type FormationGuest = z.infer<typeof formationGuestSchema>;

/** 용병을 라인업에서 선수처럼 다루기 위한 모양 (PIN·등록일은 없다) */
export function guestAsPlayer(guest: FormationGuest): Player {
  return { id: guest.id, name: guest.name, positions: guest.positions, hasPin: false, createdAt: "" };
}

/** 카톡 텍스트 등 이름 표시: 용병이면 "(용병)"을 붙인다 */
export function displayName(player: Pick<Player, "id" | "name">): string {
  return isGuestId(player.id) ? `${player.name}(용병)` : player.name;
}

/** 선수(또는 용병) id → 뛸 수 있는 쿼터. 없는 사람은 네 쿼터 모두. */
export type PlayerAvailability = Record<string, number[]>;
export const availabilitySchema = z.record(z.string(), quarterListSchema);

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
  guests: z.array(formationGuestSchema).max(30).default([]),
  availability: availabilitySchema.default({}),
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
