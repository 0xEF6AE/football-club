/**
 * 포지션 정의. 선수 등록, 포메이션 슬롯, 자동 배치가 모두 이 파일을 기준으로 동작한다.
 * 순서는 UI 표시 순서(GK → DF → MF → FW)이기도 하다.
 */
export const POSITIONS = [
  "GK",
  "LB",
  "CB",
  "RB",
  "LWB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  GK: "골키퍼",
  LB: "왼쪽 풀백",
  CB: "센터백",
  RB: "오른쪽 풀백",
  LWB: "왼쪽 윙백",
  RWB: "오른쪽 윙백",
  CDM: "수비형 미드필더",
  CM: "중앙 미드필더",
  CAM: "공격형 미드필더",
  LM: "왼쪽 미드필더",
  RM: "오른쪽 미드필더",
  LW: "왼쪽 윙어",
  RW: "오른쪽 윙어",
  ST: "스트라이커",
};

export type PositionGroup = "GK" | "DF" | "MF" | "FW";

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  GK: "GK",
  LB: "DF",
  CB: "DF",
  RB: "DF",
  LWB: "DF",
  RWB: "DF",
  CDM: "MF",
  CM: "MF",
  CAM: "MF",
  LM: "MF",
  RM: "MF",
  LW: "FW",
  RW: "FW",
  ST: "FW",
};

export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = {
  GK: "골키퍼",
  DF: "수비",
  MF: "미드필더",
  FW: "공격",
};

export const POSITION_GROUPS: PositionGroup[] = ["GK", "DF", "MF", "FW"];

/**
 * 자동 배치 시 해당 슬롯에 정확히 맞는 선수가 부족할 때 대신 세울 수 있는 유사 포지션.
 * 앞에 올수록 우선순위가 높다. GK는 대체 불가.
 */
export const POSITION_FALLBACKS: Record<Position, Position[]> = {
  GK: [],
  LB: ["LWB", "LM", "CB", "LW"],
  RB: ["RWB", "RM", "CB", "RW"],
  CB: ["CDM", "LB", "RB"],
  LWB: ["LB", "LM", "LW", "CB"],
  RWB: ["RB", "RM", "RW", "CB"],
  CDM: ["CM", "CB"],
  CM: ["CDM", "CAM"],
  CAM: ["CM", "LW", "RW", "ST"],
  LM: ["LW", "LWB", "LB", "CM"],
  RM: ["RW", "RWB", "RB", "CM"],
  LW: ["LM", "RW", "CAM", "ST"],
  RW: ["RM", "LW", "CAM", "ST"],
  ST: ["CAM", "LW", "RW"],
};

export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

/** 포지션 배열을 표시 순서(GK → DF → MF → FW)로 정렬한다. 선수의 선호 순서는 유지하지 않는다. */
export function sortPositions(positions: readonly Position[]): Position[] {
  return [...positions].sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b));
}
