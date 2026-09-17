import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createExecution,
  RunController,
  runWorkflow,
  type RunState,
} from "../../src/domain/engine";
import { inputs, seed } from "../../src/domain/fixtures";
import type { Operation, Workflow } from "../../src/domain/workflow";
function withOperation(operation: Operation): Workflow {
  const workflow = structuredClone(seed);
  workflow.nodes[1] = { ...workflow.nodes[1], type: "transform", operation };
  return workflow;
}
describe("deterministic execution", () => {
  it.each([
    ["priority", "priority", "standard"],
    ["standard", "standard", "priority"],
  ] as const)("takes the %s branch only", (input, destination, skipped) => {
    const result = runWorkflow(seed, inputs[input]);
    expect(result.path).toEqual(["receive", "normalize", "route", destination]);
    expect(result.skipped).toEqual([skipped]);
    expect(result.status).toBe("completed");
  });
  it("preserves all earlier snapshots", () => {
    const result = runWorkflow(seed, inputs.priority);
    expect(result.steps[0].output.customer).toBe("Alex Morgan");
    expect(result.steps[1].input.customer).toBe("Alex Morgan");
    expect(result.steps[1].output.customer).toBe("ALEX MORGAN");
    result.steps[2].output.customer = "changed";
    expect(result.steps[1].output.customer).toBe("ALEX MORGAN");
    expect(inputs.priority.customer).toBe("Alex Morgan");
  });
  it("captures workflow and input before first step", () => {
    const workflow = structuredClone(seed);
    const input = { ...inputs.priority };
    const execution = createExecution(workflow, input);
    workflow.nodes[1].label = "changed";
    input.customer = "changed";
    execution.next();
    expect(execution.next().value).toMatchObject({
      label: "Normalize customer",
      output: { customer: "ALEX MORGAN" },
    });
  });
  it("does not let a consumer mutate future execution through yielded data", () => {
    const execution = createExecution(seed, inputs.priority);
    const first = execution.next();
    if (!first.done) first.value.output.customer = "changed";
    expect(execution.next().value).toMatchObject({
      output: { customer: "ALEX MORGAN" },
    });
  });
  it("fails explicitly at the missing-field node", () => {
    const result = runWorkflow(seed, inputs.failure);
    expect(result.failureNode).toBe("normalize");
    expect(result.path).toEqual(["receive", "normalize"]);
    expect(result.steps[1].error).toContain("must be a string");
  });
  it("fails at the condition on a missing condition field", () => {
    const result = runWorkflow(seed, { customer: "a" });
    expect(result.failureNode).toBe("route");
    expect(result.steps[2].error).toContain("missing");
  });
  it("fails on wrong numeric type", () =>
    expect(
      runWorkflow(seed, { customer: "a", amount: "320" }).steps[2].error,
    ).toContain("must be a number"));
  it("fails instead of allowing multiplication overflow", () => {
    const result = runWorkflow(
      withOperation({
        kind: "multiply",
        field: "amount",
        factor: Number.MAX_VALUE,
      }),
      inputs.priority,
    );
    expect(result.failureNode).toBe("normalize");
    expect(result.steps[1].error).toContain("nonfinite");
  });
  it("multiplies and assigns real data", () => {
    expect(
      runWorkflow(
        withOperation({ kind: "multiply", field: "amount", factor: 2 }),
        inputs.standard,
      ).steps[1].output.amount,
    ).toBe(170);
    expect(
      runWorkflow(
        withOperation({ kind: "assign", field: "tier", value: "gold" }),
        inputs.priority,
      ).steps[1].output.tier,
    ).toBe("gold");
  });
  it("enforces the field limit on assignment", () => {
    const input = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`x${i}`, i]),
    );
    const result = runWorkflow(
      withOperation({ kind: "assign", field: "extra", value: true }),
      input,
    );
    expect(result.steps[1].error).toContain("100");
  });
  it("bounds uppercase expansion", () => {
    const result = runWorkflow(seed, {
      ...inputs.priority,
      customer: "ß".repeat(3000),
    });
    expect(result.steps[1].error).toContain("4096");
  });
});
describe("cancellation and generation fencing", () => {
  afterEach(() => vi.useRealTimers());
  it("cancel prevents future steps and preserves revealed history", () => {
    vi.useFakeTimers();
    const states: RunState[] = [];
    const controller = new RunController((state) => states.push(state));
    controller.start(seed, inputs.priority, 100);
    vi.advanceTimersByTime(100);
    controller.cancel();
    vi.runAllTimers();
    expect(states.at(-1)).toMatchObject({
      status: "cancelled",
      steps: [{ nodeId: "receive" }],
    });
    expect(states.filter((s) => s.status === "running")).toHaveLength(2);
  });
  it("reset invalidates old callbacks and immediate rerun contains its own path", () => {
    vi.useFakeTimers();
    const states: RunState[] = [];
    const controller = new RunController((state) => states.push(state));
    controller.start(seed, inputs.priority, 100);
    vi.advanceTimersByTime(100);
    controller.reset();
    controller.start(seed, inputs.standard, 100);
    vi.runAllTimers();
    expect(states.at(-1)?.result?.path).toEqual([
      "receive",
      "normalize",
      "route",
      "standard",
    ]);
    expect(states.at(-1)?.steps).toHaveLength(4);
  });
  it("validation failure preserves a completed run", () => {
    vi.useFakeTimers();
    let state: RunState | undefined;
    const controller = new RunController((next) => {
      state = next;
    });
    controller.start(seed, inputs.priority, 10);
    vi.runAllTimers();
    const before = state;
    expect(() =>
      controller.start({ ...seed, edges: [] }, inputs.priority),
    ).toThrow();
    expect(state).toBe(before);
  });
  it("dispose prevents subsequent UI updates", () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const controller = new RunController(change);
    controller.start(seed, inputs.priority, 10);
    controller.dispose();
    vi.runAllTimers();
    expect(change).toHaveBeenCalledTimes(1);
  });
});
