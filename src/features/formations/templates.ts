import type { FormationShape, FormationSlot, LineupAssignments } from "./schema";

const GK: FormationSlot = { id: "gk", position: "GK", x: 50, y: 91, row: 0 };

const BACK_FOUR: FormationSlot[] = [
  { id: "lb", position: "LB", x: 13, y: 73, row: 1 },
  { id: "cb1", position: "CB", x: 37, y: 77, row: 1 },
  { id: "cb2", position: "CB", x: 63, y: 77, row: 1 },
  { id: "rb", position: "RB", x: 87, y: 73, row: 1 },
];

const FRONT_THREE: FormationSlot[] = [
  { id: "lw", position: "LW", x: 15, y: 25, row: 4 },
  { id: "st1", position: "ST", x: 50, y: 17, row: 4 },
  { id: "rw", position: "RW", x: 85, y: 25, row: 4 },
];

const TWO_STRIKERS: FormationSlot[] = [
  { id: "st1", position: "ST", x: 35, y: 20, row: 4 },
  { id: "st2", position: "ST", x: 65, y: 20, row: 4 },
];

export const FORMATION_TEMPLATES: Record<FormationShape, FormationSlot[]> = {
  "4-2-3-1": [
    GK,
    ...BACK_FOUR,
    { id: "cdm1", position: "CDM", x: 35, y: 58, row: 2 },
    { id: "cdm2", position: "CDM", x: 65, y: 58, row: 2 },
    { id: "lw", position: "LW", x: 14, y: 38, row: 3 },
    { id: "cam", position: "CAM", x: 50, y: 41, row: 3 },
    { id: "rw", position: "RW", x: 86, y: 38, row: 3 },
    { id: "st1", position: "ST", x: 50, y: 17, row: 4 },
  ],
  "4-1-2-3": [
    GK,
    ...BACK_FOUR,
    { id: "cdm1", position: "CDM", x: 50, y: 60, row: 2 },
    { id: "cm1", position: "CM", x: 28, y: 45, row: 3 },
    { id: "cm2", position: "CM", x: 72, y: 45, row: 3 },
    ...FRONT_THREE,
  ],
  "4-3-3": [
    GK,
    ...BACK_FOUR,
    { id: "cm1", position: "CM", x: 25, y: 50, row: 2 },
    { id: "cm3", position: "CM", x: 50, y: 56, row: 2 },
    { id: "cm2", position: "CM", x: 75, y: 50, row: 2 },
    ...FRONT_THREE,
  ],
  "4-4-2": [
    GK,
    ...BACK_FOUR,
    { id: "lm", position: "LM", x: 12, y: 49, row: 2 },
    { id: "cm1", position: "CM", x: 37, y: 53, row: 2 },
    { id: "cm2", position: "CM", x: 63, y: 53, row: 2 },
    { id: "rm", position: "RM", x: 88, y: 49, row: 2 },
    ...TWO_STRIKERS,
  ],
  "3-5-2": [
    GK,
    { id: "cb1", position: "CB", x: 25, y: 77, row: 1 },
    { id: "cb3", position: "CB", x: 50, y: 80, row: 1 },
    { id: "cb2", position: "CB", x: 75, y: 77, row: 1 },
    { id: "lwb", position: "LWB", x: 10, y: 54, row: 2 },
    { id: "cdm1", position: "CDM", x: 50, y: 60, row: 2 },
    { id: "rwb", position: "RWB", x: 90, y: 54, row: 2 },
    { id: "cm1", position: "CM", x: 30, y: 44, row: 3 },
    { id: "cm2", position: "CM", x: 70, y: 44, row: 3 },
    ...TWO_STRIKERS,
  ],
};

export function getSlots(shape: FormationShape): FormationSlot[] {
  return FORMATION_TEMPLATES[shape];
}

/** 모든 슬롯 키를 갖도록 정규화. 템플릿에 없는 슬롯·허용되지 않는 선수는 버린다. */
export function normalizeAssignments(
  shape: FormationShape,
  assignments: LineupAssignments,
  allowedPlayerIds?: ReadonlySet<string>,
): LineupAssignments {
  const seen = new Set<string>();
  const result: LineupAssignments = {};
  for (const slot of getSlots(shape)) {
    const playerId = assignments[slot.id] ?? null;
    const allowed =
      playerId !== null &&
      !seen.has(playerId) &&
      (allowedPlayerIds === undefined || allowedPlayerIds.has(playerId));
    if (allowed) seen.add(playerId);
    result[slot.id] = allowed ? playerId : null;
  }
  return result;
}
