import { describe, expect, it } from "vitest";
import type { Player } from "@/features/players/schema";
import type { Position } from "@/lib/positions";
import {
  activeLineup,
  countAppearances,
  createInitialLineup,
  lineupReducer,
  restoreLineup,
  selectBench,
  toDraft,
  type LineupState,
} from "./lineup-reducer";
import { QUARTER_COUNT, type SavedFormation } from "./schema";

const player = (id: string, positions: Position[]): Player => ({ id, name: id, positions, createdAt: "" });

const players = [
  player("gk", ["GK"]),
  player("cb", ["CB"]),
  player("st", ["ST"]),
  player("cam", ["CAM"]),
  // 두 번째 골키퍼: GK 자리는 하나뿐이고 GK는 다른 자리로 대체되지 않아 자동 배치 후 반드시 벤치에 남는다.
  player("extra", ["GK"]),
];

const assignments = (state: LineupState) => activeLineup(state).assignments;

function withLineup(): LineupState {
  const initial = createInitialLineup(players);
  return lineupReducer(initial, { type: "autoAssign", players });
}

describe("lineupReducer", () => {
  it("초기 상태는 1쿼터 활성, 4쿼터 모두 4-2-3-1, 전원 참석, 빈 라인업", () => {
    const state = createInitialLineup(players);
    expect(state.quarters).toHaveLength(QUARTER_COUNT);
    expect(state.activeQuarter).toBe(0);
    expect(state.quarters.every((q) => q.shape === "4-2-3-1")).toBe(true);
    expect(state.attendingIds).toEqual(players.map((p) => p.id));
    expect(state.quarters.every((q) => Object.values(q.assignments).every((v) => v === null))).toBe(true);
    expect(state.loadedId).toBeNull();
  });

  it("자리 → 자리 탭은 두 선수를 맞바꾼다", () => {
    let state = withLineup();
    const before = { st: assignments(state).st1, cam: assignments(state).cam };

    state = lineupReducer(state, { type: "tapSlot", slotId: "st1" });
    expect(state.selection).toEqual({ kind: "slot", slotId: "st1" });
    state = lineupReducer(state, { type: "tapSlot", slotId: "cam" });

    expect(assignments(state).st1).toBe(before.cam);
    expect(assignments(state).cam).toBe(before.st);
    expect(state.selection).toBeNull();
  });

  it("벤치 → 자리 탭은 벤치 선수를 그 자리에 세우고, 있던 선수는 벤치로 보낸다", () => {
    let state = withLineup();
    expect(selectBench(state, players).map((p) => p.id)).toContain("extra");

    state = lineupReducer(state, { type: "tapBench", playerId: "extra" });
    state = lineupReducer(state, { type: "tapSlot", slotId: "st1" });

    expect(assignments(state).st1).toBe("extra");
    expect(selectBench(state, players).map((p) => p.id)).toContain("st");
  });

  it("자리 → 벤치 탭은 벤치 선수를 그 자리에 세운다", () => {
    let state = withLineup();
    state = lineupReducer(state, { type: "tapSlot", slotId: "cam" });
    state = lineupReducer(state, { type: "tapBench", playerId: "extra" });
    expect(assignments(state).cam).toBe("extra");
  });

  it("참석을 해제하면 그 선수는 모든 쿼터의 라인업에서 빠진다", () => {
    let state = lineupReducer(createInitialLineup(players), { type: "autoAssignAll", players });
    expect(state.quarters.some((q) => Object.values(q.assignments).includes("gk"))).toBe(true);
    state = lineupReducer(state, { type: "toggleAttending", playerId: "gk" });
    expect(state.quarters.every((q) => !Object.values(q.assignments).includes("gk"))).toBe(true);
    expect(state.attendingIds).not.toContain("gk");
  });

  it("포메이션을 바꿔도 같은 id의 자리는 선수를 이어받고, 다른 쿼터는 그대로다", () => {
    let state = lineupReducer(createInitialLineup(players), { type: "autoAssignAll", players });
    const second = state.quarters[1];
    const gk = assignments(state).gk;
    const st = assignments(state).st1;
    state = lineupReducer(state, { type: "setShape", shape: "4-4-2" });
    expect(activeLineup(state).shape).toBe("4-4-2");
    expect(assignments(state).gk).toBe(gk);
    expect(assignments(state).st1).toBe(st);
    expect(assignments(state)).not.toHaveProperty("cam");
    expect(state.quarters[1]).toBe(second);
  });

  it("쿼터를 바꾸면 선택이 풀리고, 자리 조작은 그 쿼터에만 적용된다", () => {
    let state = withLineup();
    const first = state.quarters[0];
    state = lineupReducer(state, { type: "tapSlot", slotId: "st1" });
    state = lineupReducer(state, { type: "setQuarter", index: 1 });
    expect(state.activeQuarter).toBe(1);
    expect(state.selection).toBeNull();

    state = lineupReducer(state, { type: "tapBench", playerId: "extra" });
    state = lineupReducer(state, { type: "tapSlot", slotId: "st1" });
    expect(state.quarters[1].assignments.st1).toBe("extra");
    expect(state.quarters[0]).toBe(first);
  });

  it("범위를 벗어난 쿼터 번호는 무시한다", () => {
    const state = withLineup();
    expect(lineupReducer(state, { type: "setQuarter", index: 4 })).toBe(state);
    expect(lineupReducer(state, { type: "setQuarter", index: -1 })).toBe(state);
  });

  it("앞 쿼터의 모양과 배치를 복사해 온다", () => {
    let state = withLineup();
    state = lineupReducer(state, { type: "setShape", shape: "3-5-2" });
    const first = state.quarters[0];
    state = lineupReducer(state, { type: "setQuarter", index: 1 });
    state = lineupReducer(state, { type: "copyQuarter", from: 0 });
    expect(state.quarters[1]).toEqual(first);
    expect(state.quarters[1]).not.toBe(first);
  });

  it("4쿼터 자동 배치는 앞 쿼터에서 쉰 선수를 다음 쿼터에 먼저 세운다", () => {
    const state = lineupReducer(createInitialLineup(players), { type: "autoAssignAll", players });
    const keepers = state.quarters.map((q) => q.assignments.gk);
    expect(keepers).toEqual(["gk", "extra", "gk", "extra"]);
    const counts = countAppearances(state.quarters);
    expect(counts.get("gk")).toBe(2);
    expect(counts.get("extra")).toBe(2);
    expect(counts.get("cb")).toBe(4);
  });

  it("한 쿼터만 자동 배치할 때도 다른 쿼터 출전 수를 반영한다", () => {
    let state = lineupReducer(createInitialLineup(players), { type: "autoAssignAll", players });
    // 2쿼터(extra가 GK)를 비우고 다시 배치하면 1·3쿼터에서 뛴 gk 대신 extra가 다시 선다.
    state = lineupReducer(state, { type: "setQuarter", index: 1 });
    state = lineupReducer(state, { type: "clearAll" });
    expect(assignments(state).gk).toBeNull();
    state = lineupReducer(state, { type: "autoAssign", players });
    expect(assignments(state).gk).toBe("extra");
  });

  it("저장본을 불러오면 사라진 선수는 걸러지고 1쿼터부터 보여 준다", () => {
    const formation: SavedFormation = {
      id: "f1",
      name: "테스트",
      attendingIds: ["gk", "ghost"],
      quarters: [
        { shape: "4-3-3", assignments: { gk: "gk", cm1: "ghost" } },
        { shape: "4-4-2", assignments: { gk: "ghost" } },
        { shape: "4-2-3-1", assignments: {} },
        { shape: "4-2-3-1", assignments: {} },
      ],
      createdAt: "",
      updatedAt: "",
    };
    let state = lineupReducer(createInitialLineup(players), { type: "setQuarter", index: 2 });
    state = lineupReducer(state, {
      type: "load",
      formation,
      validPlayerIds: new Set(players.map((p) => p.id)),
    });
    expect(state.activeQuarter).toBe(0);
    expect(state.attendingIds).toEqual(["gk"]);
    expect(state.quarters[0].shape).toBe("4-3-3");
    expect(state.quarters[0].assignments.gk).toBe("gk");
    expect(state.quarters[0].assignments.cm1).toBeNull();
    expect(state.quarters[1].assignments.gk).toBeNull();
    expect(state.loadedId).toBe("f1");
  });
});

describe("restoreLineup", () => {
  it("임시 저장본을 복원하고 잘못된 선수 id는 버린다", () => {
    const draft = toDraft(withLineup());
    draft.attendingIds = ["gk", "nobody"];
    draft.quarters[0] = { shape: "4-2-3-1", assignments: { gk: "gk", cb1: "nobody" } };
    draft.activeQuarter = 2;
    const state = restoreLineup(players, draft);
    expect(state?.activeQuarter).toBe(2);
    expect(state?.attendingIds).toEqual(["gk"]);
    expect(state?.quarters[0].assignments.gk).toBe("gk");
    expect(state?.quarters[0].assignments.cb1).toBeNull();
  });

  it("형식이 깨진 저장본(옛 단일 라인업 형식 포함)은 null", () => {
    expect(restoreLineup(players, null)).toBeNull();
    expect(restoreLineup(players, { shape: "4-2-3-1", attendingIds: [], assignments: {}, loadedId: null })).toBeNull();
    expect(restoreLineup(players, { ...toDraft(withLineup()), quarters: [] })).toBeNull();
  });
});
