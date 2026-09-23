import { describe, expect, it } from "vitest";
import {
  initialHistory,
  historyReducer,
  MAX_HISTORY,
} from "../../src/domain/history";
import { seed } from "../../src/domain/fixtures";

describe("workflow edit history", () => {
  it("coalesces one field session, drops redo after a new edit and ignores no-ops", () => {
    let state = initialHistory(seed);
    for (const name of ["A", "AB", "ABC"])
      state = historyReducer(state, {
        type: "edit",
        workflow: { ...seed, name },
        group: 1,
      });
    expect(state.past).toHaveLength(1);
    expect(
      historyReducer(state, {
        type: "edit",
        workflow: { ...state.current },
        group: null,
      }),
    ).toBe(state);
    state = historyReducer(state, { type: "undo" });
    expect(state.current).toEqual(seed);
    state = historyReducer(state, { type: "redo" });
    expect(state.current.name).toBe("ABC");
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, {
      type: "edit",
      workflow: { ...seed, name: "Another" },
      group: 2,
    });
    expect(state.future).toHaveLength(0);
  });
  it("restores incomplete graphs and incident edges atomically without mutating snapshots", () => {
    const original = structuredClone(seed);
    const changed = { ...original, nodes: original.nodes.slice(1), edges: [] };
    let state = historyReducer(initialHistory(original), {
      type: "edit",
      workflow: changed,
      group: null,
    });
    state = historyReducer(state, { type: "undo" });
    expect(state.current).toEqual(seed);
    expect(historyReducer(state, { type: "redo" }).current).toEqual(changed);
    expect(original).toEqual(seed);
  });
  it("bounds snapshots across undo/redo and keeps non-finite drafts distinct", () => {
    let state = initialHistory(seed);
    for (let i = 0; i < MAX_HISTORY + 10; i++)
      state = historyReducer(state, {
        type: "edit",
        workflow: { ...seed, name: String(i) },
        group: null,
      });
    expect(state.past).toHaveLength(MAX_HISTORY);
    for (let i = 0; i < MAX_HISTORY; i++)
      state = historyReducer(state, { type: "undo" });
    expect(state.future).toHaveLength(MAX_HISTORY);
    expect(historyReducer(state, { type: "undo" })).toBe(state);
    const a = structuredClone(seed),
      b = structuredClone(seed);
    a.nodes[0].position.x = NaN;
    b.nodes[0].position.x = Infinity;
    const next = historyReducer(initialHistory(a), {
      type: "edit",
      workflow: b,
      group: null,
    });
    expect(next.past).toHaveLength(1);
    expect(Number.isNaN(next.past[0].nodes[0].position.x)).toBe(true);
  });
});
