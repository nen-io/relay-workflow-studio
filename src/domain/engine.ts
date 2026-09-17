import {
  validatePayload,
  validateWorkflow,
  type Payload,
  type Workflow,
} from "./workflow";
export type Step = {
  nodeId: string;
  label: string;
  input: Payload;
  output: Payload;
  branch?: "true" | "false";
  error?: string;
};
export type Result = {
  status: "completed" | "failed";
  steps: Step[];
  path: string[];
  skipped: string[];
  failureNode?: string;
};
/** One pure synchronous step per yield. The caller owns scheduling; the engine owns all semantics. */
export function createExecution(
  workflow: Workflow,
  input: Payload,
): Generator<Step, Result> {
  validateWorkflow(workflow);
  const captured = structuredClone(workflow);
  const payload = validatePayload(input);
  return execute(captured, payload);
}
function* execute(
  workflow: Workflow,
  original: Payload,
): Generator<Step, Result> {
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(
    workflow.nodes.map((node) => [
      node.id,
      workflow.edges.filter((edge) => edge.source === node.id),
    ]),
  );
  const steps: Step[] = [];
  let current = workflow.nodes.find((node) => node.type === "trigger")!.id;
  let payload = { ...original };
  let failureNode: string | undefined;
  while (current) {
    const node = nodes.get(current)!;
    const step: Step = {
      nodeId: node.id,
      label: node.label,
      input: { ...payload },
      output: { ...payload },
    };
    try {
      if (node.type === "transform") {
        const operation = node.operation;
        const value = payload[operation.field];
        if (operation.kind === "uppercase") {
          if (typeof value !== "string")
            throw new Error(`Field "${operation.field}" must be a string.`);
          const upper = value.toUpperCase();
          if (upper.length > 4096)
            throw new Error("Uppercase result exceeds 4096 characters.");
          step.output[operation.field] = upper;
        } else if (operation.kind === "multiply") {
          if (typeof value !== "number")
            throw new Error(`Field "${operation.field}" must be a number.`);
          const product = value * operation.factor;
          if (!Number.isFinite(product))
            throw new Error("Multiplication produced a nonfinite number.");
          step.output[operation.field] = product;
        } else {
          if (
            !Object.hasOwn(step.output, operation.field) &&
            Object.keys(step.output).length >= 100
          )
            throw new Error("Assignment would exceed 100 input fields.");
          step.output[operation.field] = operation.value;
        }
      }
      if (node.type === "condition") {
        if (!Object.hasOwn(payload, node.field))
          throw new Error(`Field "${node.field}" is missing.`);
        if (
          node.comparator === "greater-than" &&
          typeof payload[node.field] !== "number"
        )
          throw new Error(`Field "${node.field}" must be a number.`);
        step.branch = (
          node.comparator === "equals"
            ? payload[node.field] === node.value
            : (payload[node.field] as number) > (node.value as number)
        )
          ? "true"
          : "false";
      }
    } catch (error) {
      step.error = error instanceof Error ? error.message : "Execution failed.";
      failureNode = current;
    }
    steps.push(structuredClone(step));
    yield structuredClone(step);
    if (failureNode) break;
    payload = { ...step.output };
    const next = adjacency
      .get(current)!
      .find((edge) => !edge.branch || edge.branch === step.branch);
    current = next?.target ?? "";
  }
  const path = steps.map((step) => step.nodeId);
  return {
    status: failureNode ? "failed" : "completed",
    steps,
    path,
    skipped: workflow.nodes
      .filter((node) => !path.includes(node.id))
      .map((node) => node.id),
    ...(failureNode ? { failureNode } : {}),
  };
}
export function runWorkflow(workflow: Workflow, input: Payload): Result {
  const execution = createExecution(workflow, input);
  let next = execution.next();
  while (!next.done) next = execution.next();
  return next.value;
}
export type RunState = {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  steps: Step[];
  result?: Result;
};
/** Generation fencing handles a queued callback even if clearTimeout loses the race. */
export class RunController {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private state: RunState = { status: "idle", steps: [] };
  constructor(private onChange: (state: RunState) => void) {}
  start(workflow: Workflow, input: Payload, delay = 450): void {
    const execution = createExecution(workflow, input); // A validation failure preserves the previous run.
    this.invalidate();
    const generation = this.generation;
    this.state = { status: "running", steps: [] };
    this.onChange(this.state);
    const advance = () => {
      if (generation !== this.generation) return;
      const next = execution.next();
      if (next.done)
        this.state = {
          status: next.value.status,
          steps: next.value.steps,
          result: next.value,
        };
      else
        this.state = {
          status: "running",
          steps: [...this.state.steps, next.value],
        };
      this.onChange(this.state);
      if (!next.done) this.timer = setTimeout(advance, delay);
    };
    this.timer = setTimeout(advance, delay);
  }
  cancel(): void {
    this.invalidate();
    this.state = { ...this.state, status: "cancelled" };
    this.onChange(this.state);
  }
  reset(): void {
    this.invalidate();
    this.state = { status: "idle", steps: [] };
    this.onChange(this.state);
  }
  dispose(): void {
    this.invalidate();
  }
  private invalidate(): void {
    this.generation++;
    clearTimeout(this.timer);
  }
}
