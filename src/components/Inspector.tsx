import { useEffect, useId, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Step } from "../domain/engine";
import type { Scalar, Workflow, WorkflowNode } from "../domain/workflow";
import { description, nodeIcons } from "./Graph";
function ScalarField({
  label,
  value,
  commit,
}: {
  label: string;
  value: Scalar;
  commit: (value: Scalar) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState(JSON.stringify(value));
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(JSON.stringify(value));
  }, [value]);
  function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      parsed = draft;
    }
    if (!(
      parsed === null ||
      typeof parsed === "boolean" ||
      (typeof parsed === "number" && Number.isFinite(parsed)) ||
      (typeof parsed === "string" && parsed.length <= 4096)
    )) {
      setError("Enter a finite scalar; strings allow at most 4096 characters.");
      return;
    }
    setError("");
    commit(parsed);
    setDraft(JSON.stringify(parsed));
  }
  return (
    <label>
      {label}
      <input
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span id={errorId} role="alert" className="error">
          {error}
        </span>
      )}
    </label>
  );
}
function PositionField({
  axis,
  value,
  commit,
}: {
  axis: "x" | "y";
  value: number;
  commit: (value: number) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  useEffect(() => setDraft(String(value)), [value]);
  function save() {
    const number = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(number) ||
      number < 0 ||
      number > 3000
    ) {
      setError("Use a number from 0 to 3000.");
      return;
    }
    setError("");
    commit(number);
  }
  return (
    <label>
      {axis.toUpperCase()} position
      <input
        aria-label={`${axis.toUpperCase()} position`}
        type="number"
        min="0"
        max="3000"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span id={errorId} role="alert" className="error">
          {error}
        </span>
      )}
    </label>
  );
}
export function Inspector({
  node,
  workflow,
  step,
  disabled,
  back,
  update,
  remove,
  connect,
}: {
  node?: WorkflowNode;
  workflow: Workflow;
  step?: Step;
  disabled: boolean;
  back: () => void;
  update: (node: WorkflowNode) => void;
  remove: () => void;
  connect: (target: string, branch?: "true" | "false") => void;
}) {
  if (!node)
    return (
      <aside
        id="node-inspector"
        tabIndex={-1}
        className="inspector panel"
        aria-label="Node inspector"
      >
        <h2>Node inspector</h2>
        <p>Select a node to edit its behavior and connections.</p>
      </aside>
    );
  const Icon = nodeIcons[node.type];
  const branches =
    node.type === "condition" ? (["true", "false"] as const) : [undefined];
  return (
    <aside
      id="node-inspector"
      tabIndex={-1}
      className="inspector panel"
      aria-label="Node inspector"
    >
      <button className="back-to-workflow" onClick={back}>
        Back to workflow
      </button>
      <div className="panel-heading">
        <span>NODE INSPECTOR</span>
        <span className="tiny-dot" />
      </div>
      <div className={`inspector-title ${node.type}`}>
        <span className="large-icon">
          <Icon size={22} />
        </span>
        <div>
          <h2>{node.label}</h2>
          <p>{description(node)}</p>
        </div>
      </div>
      <fieldset disabled={disabled}>
        <label>
          Node name
          <input
            id="node-name"
            maxLength={160}
            value={node.label}
            onChange={(event) => update({ ...node, label: event.target.value })}
          />
        </label>
        {node.type === "transform" && (
          <>
            <label>
              Operation
              <select
                aria-label="Operation"
                value={node.operation.kind}
                onChange={(event) => {
                  const kind = event.target.value;
                  update({
                    ...node,
                    operation:
                      kind === "multiply"
                        ? { kind, field: node.operation.field, factor: 2 }
                        : kind === "assign"
                          ? {
                              kind,
                              field: node.operation.field,
                              value: "value",
                            }
                          : { kind: "uppercase", field: node.operation.field },
                  });
                }}
              >
                <option value="uppercase">Uppercase string</option>
                <option value="multiply">Multiply number</option>
                <option value="assign">Assign scalar</option>
              </select>
            </label>
            <label>
              Field name
              <input
                value={node.operation.field}
                maxLength={80}
                onChange={(event) =>
                  update({
                    ...node,
                    operation: { ...node.operation, field: event.target.value },
                  })
                }
              />
            </label>
            {node.operation.kind === "multiply" && (
              <label>
                Multiply by
                <input
                  type="number"
                  value={
                    Number.isFinite(node.operation.factor)
                      ? node.operation.factor
                      : ""
                  }
                  onChange={(event) =>
                    update({
                      ...node,
                      operation: {
                        kind: "multiply",
                        field: node.operation.field,
                        factor: event.target.valueAsNumber,
                      },
                    })
                  }
                />
              </label>
            )}
            {node.operation.kind === "assign" && (
              <ScalarField
                label="Assignment value"
                value={node.operation.value}
                commit={(value) =>
                  update({
                    ...node,
                    operation: {
                      kind: "assign",
                      field: node.operation.field,
                      value,
                    },
                  })
                }
              />
            )}
          </>
        )}
        {node.type === "condition" && (
          <>
            <label>
              Field name
              <input
                value={node.field}
                maxLength={80}
                onChange={(event) =>
                  update({ ...node, field: event.target.value })
                }
              />
            </label>
            <label>
              Comparison
              <select
                aria-label="Comparison"
                value={node.comparator}
                onChange={(event) =>
                  update({
                    ...node,
                    comparator: event.target.value as "equals" | "greater-than",
                  })
                }
              >
                <option value="greater-than">Greater than</option>
                <option value="equals">Equals (strict type)</option>
              </select>
            </label>
            <ScalarField
              label="Compare value"
              value={node.value}
              commit={(value) => update({ ...node, value })}
            />
            <p className="hint">
              Values save on blur or Enter. JSON literals keep their type; use
              quotes for numeric-looking strings.
            </p>
          </>
        )}
        {node.type !== "output" && (
          <div className="connection-controls">
            <h3>Connections</h3>
            {branches.map((branch) => (
              <label key={branch ?? "next"}>
                {branch ? `When ${branch}` : "Next node"}
                <select
                  aria-label={branch ? `When ${branch}` : "Next node"}
                  value={
                    workflow.edges.find(
                      (edge) =>
                        edge.source === node.id && edge.branch === branch,
                    )?.target ?? ""
                  }
                  onChange={(event) => connect(event.target.value, branch)}
                >
                  <option value="">Disconnected</option>
                  {workflow.nodes
                    .filter(
                      (target) =>
                        target.id !== node.id && target.type !== "trigger",
                    )
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <details className="layout-controls">
          <summary>Canvas position</summary>
          <div className="coordinate-fields">
            {(["x", "y"] as const).map((axis) => (
              <PositionField
                key={axis}
                axis={axis}
                value={node.position[axis]}
                commit={(value) =>
                  update({
                    ...node,
                    position: { ...node.position, [axis]: value },
                  })
                }
              />
            ))}
          </div>
        </details>
        <button className="delete-button" onClick={remove}>
          <Trash2 size={14} /> Delete node
        </button>
      </fieldset>
      <div className="payloads">
        <h3>Captured step</h3>
        {step ? (
          <>
            <p className="hint">Snapshots from the displayed run.</p>
            <h4>Input</h4>
            <pre data-testid="step-input">
              {JSON.stringify(step.input, null, 2)}
            </pre>
            <h4>Output{step.branch ? ` · ${step.branch} branch` : ""}</h4>
            <pre data-testid="step-output">
              {JSON.stringify(step.output, null, 2)}
            </pre>
            {step.error && (
              <p role="alert" className="error">
                {step.error}
              </p>
            )}
          </>
        ) : (
          <p className="hint">
            {node.label} has no captured step. Run the workflow to inspect its
            payload.
          </p>
        )}
      </div>
    </aside>
  );
}
