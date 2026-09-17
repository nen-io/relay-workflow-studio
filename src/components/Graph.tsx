import {
  ArrowDownToLine,
  GitBranch,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import type { RunState } from "../domain/engine";
import type { Workflow, WorkflowNode } from "../domain/workflow";
export const nodeIcons = {
  trigger: Radio,
  transform: SlidersHorizontal,
  condition: GitBranch,
  output: ArrowDownToLine,
};
export function description(node: WorkflowNode): string {
  if (node.type === "transform")
    return `${node.operation.kind} · ${node.operation.field}`;
  if (node.type === "condition")
    return `${node.field} ${node.comparator === "equals" ? "=" : ">"} ${JSON.stringify(node.value)}`;
  return node.type === "trigger" ? "Manual trigger" : "Workflow destination";
}
export function Graph({
  workflow,
  selected,
  select,
  run,
  list,
}: {
  workflow: Workflow;
  selected: string;
  select: (id: string) => void;
  run: RunState;
  list: boolean;
}) {
  const seen = new Set(run.steps.map((step) => step.nodeId));
  const end = ["completed", "failed"].includes(run.status);
  const width = Math.max(
    760,
    ...workflow.nodes.map((node) => node.position.x + 240),
  );
  const height = Math.max(
    655,
    ...workflow.nodes.map((node) => node.position.y + 135),
  );
  return (
    <div className={`graph ${list ? "list-mode" : ""}`}>
      <div className="canvas" style={{ aspectRatio: `${width}/${height}` }}>
        <svg
          className="connections"
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0 0 L6 3 L0 6" fill="currentColor" />
            </marker>
          </defs>
          {workflow.edges.map((edge) => {
            const from = workflow.nodes.find((node) => node.id === edge.source),
              to = workflow.nodes.find((node) => node.id === edge.target);
            if (!from || !to) return null;
            const x1 = from.position.x + 110,
              y1 = from.position.y + 75,
              x2 = to.position.x + 110,
              y2 = to.position.y;
            const active = run.steps.some(
              (step, i) =>
                step.nodeId === edge.source &&
                run.steps[i + 1]?.nodeId === edge.target &&
                (!edge.branch || step.branch === edge.branch),
            );
            return (
              <g key={edge.id} className={active ? "edge active" : "edge"}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${y1 + 38}, ${x2} ${y2 - 38}, ${x2} ${y2 - 4}`}
                  markerEnd="url(#arrow)"
                />
                {edge.branch && (
                  <>
                    <rect
                      x={(x1 + x2) / 2 - 24}
                      y={(y1 + y2) / 2 - 11}
                      width="48"
                      height="22"
                      rx="11"
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 + 4}
                      textAnchor="middle"
                    >
                      {edge.branch}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
        {workflow.nodes.map((node, index) => {
          const Icon = nodeIcons[node.type];
          const step = run.steps.find((item) => item.nodeId === node.id);
          const status = step?.error
            ? "failed"
            : seen.has(node.id)
              ? "visited"
              : end
                ? "skipped"
                : "ready";
          return (
            <button
              key={node.id}
              className={`node ${node.type} ${selected === node.id ? "selected" : ""} ${status}`}
              style={{
                left: `${(node.position.x / width) * 100}%`,
                top: `${(node.position.y / height) * 100}%`,
                width: `${(220 / width) * 100}%`,
              }}
              onClick={() => select(node.id)}
              aria-pressed={selected === node.id}
              aria-label={`Inspect ${node.label}`}
            >
              <span className="node-top">
                <span className="node-icon">
                  <Icon size={16} />
                </span>
                <span>{node.type}</span>
                <span className="node-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <strong>{node.label}</strong>
              <span className="node-detail">{description(node)}</span>
              <span className={`node-status ${status}`}>{status}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
