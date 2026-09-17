export type Scalar = string | number | boolean | null;
export type Payload = Record<string, Scalar>;
export type Operation =
  | { kind: "uppercase"; field: string }
  | { kind: "multiply"; field: string; factor: number }
  | { kind: "assign"; field: string; value: Scalar };
type BaseNode = {
  id: string;
  label: string;
  position: { x: number; y: number };
};
export type WorkflowNode = BaseNode &
  (
    | { type: "trigger" | "output" }
    | { type: "transform"; operation: Operation }
    | {
        type: "condition";
        field: string;
        comparator: "equals" | "greater-than";
        value: Scalar;
      }
  );
export type Edge = {
  id: string;
  source: string;
  target: string;
  branch?: "true" | "false";
};
export type Workflow = {
  version: 1;
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: Edge[];
};
export const MAX_BYTES = 128 * 1024;
export const LIMITS = {
  nodes: 40,
  edges: 80,
  fields: 100,
  text: 4096,
} as const;
const forbidden = new Set(["__proto__", "constructor", "prototype"]);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 160): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const scalar = (value: unknown): value is Scalar =>
  value === null ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  (typeof value === "string" && value.length <= LIMITS.text);
const field = (value: unknown): value is string =>
  text(value, 80) && !forbidden.has(value);
export class ValidationError extends Error {
  constructor(public issues: string[]) {
    super(issues.join("\n"));
    this.name = "ValidationError";
  }
}
function checkKeys(value: unknown, issues: string[], depth = 0): void {
  if (depth > 12) {
    issues.push("Document nesting exceeds 12 levels.");
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) issues.push(`Forbidden property name: ${key}.`);
    checkKeys(child, issues, depth + 1);
  }
}
function assertByteLimit(source: string): void {
  if (new TextEncoder().encode(source).length > MAX_BYTES)
    throw new ValidationError(["Document exceeds 128 KiB."]);
}
export function parsePayload(source: string): Payload {
  assertByteLimit(source);
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ValidationError(["Input must be valid JSON."]);
  }
  return validatePayload(value);
}
export function validatePayload(value: unknown): Payload {
  if (!object(value))
    throw new ValidationError(["Input must be a shallow JSON object."]);
  if (Object.keys(value).length > LIMITS.fields)
    throw new ValidationError(["Input exceeds 100 fields."]);
  for (const [key, item] of Object.entries(value)) {
    if (!field(key))
      throw new ValidationError([`Invalid or forbidden input field: ${key}.`]);
    if (!scalar(item))
      throw new ValidationError([
        `Input field ${key} must be a finite scalar (string ≤4096 characters).`,
      ]);
  }
  return { ...value } as Payload;
}
/** Structural validation happens before graph traversal, so no untrusted node reaches execution. */
export function validateWorkflow(value: unknown): asserts value is Workflow {
  const errors: string[] = [];
  checkKeys(value, errors);
  if (
    !object(value) ||
    value.version !== 1 ||
    !text(value.id) ||
    !text(value.name)
  )
    throw new ValidationError([
      ...errors,
      "Workflow requires version 1, a nonempty id and name (≤160 characters).",
    ]);
  if (
    !Array.isArray(value.nodes) ||
    value.nodes.length < 1 ||
    value.nodes.length > LIMITS.nodes
  )
    errors.push("Workflow needs 1–40 nodes.");
  if (!Array.isArray(value.edges) || value.edges.length > LIMITS.edges)
    errors.push("Workflow allows at most 80 edges.");
  if (errors.length) throw new ValidationError(errors);
  const nodes = value.nodes as unknown[];
  const edges = value.edges as unknown[];
  for (const node of nodes) {
    if (
      !object(node) ||
      !text(node.id) ||
      !text(node.label) ||
      !object(node.position) ||
      ![node.position.x, node.position.y].every(
        (n) =>
          typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 3000,
      )
    ) {
      errors.push(
        "Every node needs id, label and finite position coordinates in 0–3000.",
      );
      continue;
    }
    if (node.type === "transform") {
      const op = node.operation;
      if (
        !object(op) ||
        !field(op.field) ||
        typeof op.kind !== "string" ||
        !["uppercase", "multiply", "assign"].includes(op.kind) ||
        (op.kind === "multiply" &&
          !(typeof op.factor === "number" && Number.isFinite(op.factor))) ||
        (op.kind === "assign" && !scalar(op.value))
      )
        errors.push(`${node.label}: invalid transform or forbidden field.`);
    } else if (node.type === "condition") {
      if (
        !field(node.field) ||
        typeof node.comparator !== "string" ||
        !["equals", "greater-than"].includes(node.comparator) ||
        !scalar(node.value) ||
        (node.comparator === "greater-than" && typeof node.value !== "number")
      )
        errors.push(
          `${node.label}: invalid condition or forbidden field; greater-than requires a number.`,
        );
    } else if (node.type !== "trigger" && node.type !== "output")
      errors.push(`${node.label}: unsupported node type.`);
  }
  for (const edge of edges) {
    if (
      !object(edge) ||
      !text(edge.id) ||
      !text(edge.source) ||
      !text(edge.target) ||
      (edge.branch !== undefined &&
        edge.branch !== "true" &&
        edge.branch !== "false")
    )
      errors.push(
        "Every edge needs id, source, target and an optional true/false branch.",
      );
  }
  if (errors.length) throw new ValidationError(errors);
  const workflow = value as Workflow;
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) errors.push("Node IDs must be unique.");
  if (new Set(workflow.edges.map((edge) => edge.id)).size !== edges.length)
    errors.push("Edge IDs must be unique.");
  const signatures = workflow.edges.map((edge) =>
    JSON.stringify([edge.source, edge.target, edge.branch ?? ""]),
  );
  if (new Set(signatures).size !== edges.length)
    errors.push("Duplicate connections are not allowed.");
  const triggers = workflow.nodes.filter((node) => node.type === "trigger");
  if (triggers.length !== 1)
    errors.push("Workflow requires exactly one trigger.");
  const adjacency = new Map(
    workflow.nodes.map((node) => [node.id, [] as Edge[]]),
  );
  for (const edge of workflow.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      errors.push(`Connection ${edge.id} has a missing node.`);
      continue;
    }
    adjacency.get(edge.source)!.push(edge);
    if (byId.get(edge.target)!.type === "trigger")
      errors.push("Connections cannot enter the trigger.");
  }
  for (const node of workflow.nodes) {
    const outgoing = adjacency.get(node.id)!;
    if (node.type === "condition") {
      if (
        outgoing.length !== 2 ||
        outgoing.filter((edge) => edge.branch === "true").length !== 1 ||
        outgoing.filter((edge) => edge.branch === "false").length !== 1
      )
        errors.push(
          `${node.label}: connect exactly one true and one false branch.`,
        );
    } else {
      if (outgoing.length !== (node.type === "output" ? 0 : 1))
        errors.push(
          `${node.label}: expected ${node.type === "output" ? "no outgoing connections" : "one outgoing connection"}.`,
        );
      if (outgoing.some((edge) => edge.branch))
        errors.push(`${node.label}: only conditions can label branches.`);
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  let cyclic = false;
  function visit(id: string): void {
    if (active.has(id)) {
      cyclic = true;
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    active.add(id);
    for (const edge of adjacency.get(id) ?? []) visit(edge.target);
    active.delete(id);
  }
  if (triggers[0]) visit(triggers[0].id);
  if (visited.size !== byId.size)
    errors.push("All nodes must be reachable from the trigger.");
  // Inspect disconnected components too, so a disconnected cycle is diagnosed directly.
  for (const id of byId.keys()) visit(id);
  if (cyclic) errors.push("Workflow contains a cycle.");
  if (errors.length) throw new ValidationError(errors);
}
export function parseWorkflow(source: string): Workflow {
  assertByteLimit(source);
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ValidationError(["Workflow file is not valid JSON."]);
  }
  validateWorkflow(value);
  return structuredClone(value);
}
export function exportWorkflow(workflow: Workflow): string {
  validateWorkflow(workflow);
  const source = JSON.stringify(workflow, null, 2);
  assertByteLimit(source);
  return source;
}
export function deleteNode(workflow: Workflow, id: string): Workflow {
  return {
    ...workflow,
    nodes: workflow.nodes.filter((node) => node.id !== id),
    edges: workflow.edges.filter(
      (edge) => edge.source !== id && edge.target !== id,
    ),
  };
}
export function connect(
  workflow: Workflow,
  source: string,
  target: string,
  branch?: "true" | "false",
): Workflow {
  const remaining = workflow.edges.filter(
    (edge) => !(edge.source === source && edge.branch === branch),
  );
  return {
    ...workflow,
    edges: target
      ? [
          ...remaining,
          {
            id: `${source}-${branch ?? "next"}-${target}`,
            source,
            target,
            ...(branch ? { branch } : {}),
          },
        ]
      : remaining,
  };
}
