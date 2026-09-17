import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  GitBranch,
  LayoutGrid,
  List,
  Play,
  Plus,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Terminal,
} from "lucide-react";
import { Graph } from "./components/Graph";
import { Inspector } from "./components/Inspector";
import { RunController, type RunState } from "./domain/engine";
import { inputs, seed } from "./domain/fixtures";
import {
  connect,
  deleteNode,
  exportWorkflow,
  MAX_BYTES,
  parsePayload,
  parseWorkflow,
  validateWorkflow,
  ValidationError,
  type Workflow,
  type WorkflowNode,
} from "./domain/workflow";
import { restore, save } from "./domain/storage";
function load() {
  try {
    return restore(localStorage, seed);
  } catch {
    return {
      workflow: structuredClone(seed),
      warning: "Local storage is unavailable; editing still works.",
    };
  }
}
const types = [
  {
    type: "trigger",
    icon: Radio,
    title: "Trigger",
    description: "Start with an event",
  },
  {
    type: "transform",
    icon: SlidersHorizontal,
    title: "Transform",
    description: "Shape your payload",
  },
  {
    type: "condition",
    icon: GitBranch,
    title: "Condition",
    description: "Choose a direction",
  },
  {
    type: "output",
    icon: ArrowDownToLine,
    title: "Output",
    description: "Finish the workflow",
  },
] as const;
export default function App() {
  const [initial] = useState(load);
  const [workflow, setWorkflow] = useState(initial.workflow);
  const [warning, setWarning] = useState(initial.warning);
  const [selected, setSelected] = useState("route");
  const [example, setExample] = useState("priority");
  const [input, setInput] = useState(JSON.stringify(inputs.priority, null, 2));
  const [run, setRun] = useState<RunState>({ status: "idle", steps: [] });
  const [controller] = useState(() => new RunController(setRun));
  const [errors, setErrors] = useState<string[]>([]);
  const [list, setList] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const importGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const running = run.status === "running";
  useEffect(
    () => () => {
      controller.dispose();
      importGeneration.current++;
    },
    [controller],
  );
  const report = (error: unknown) =>
    setErrors(
      error instanceof ValidationError
        ? error.issues
        : [
            error instanceof Error
              ? error.message
              : "The operation could not be completed.",
          ],
    );
  function change(next: Workflow) {
    importGeneration.current++;
    setWorkflow(next);
    setDirty(run.status !== "idle");
    setErrors([]);
    setNotice("");
    try {
      setWarning(save(localStorage, next));
    } catch {
      setWarning(
        "Local storage is unavailable; export a valid graph to keep your changes.",
      );
    }
  }
  function start() {
    importGeneration.current++;
    try {
      const payload = parsePayload(input);
      controller.start(
        workflow,
        payload,
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
      );
      setErrors([]);
      setDirty(false);
      setNotice("");
    } catch (error) {
      report(error);
    }
  }
  function reset() {
    controller.reset();
    importGeneration.current++;
    setWorkflow(structuredClone(seed));
    setInput(JSON.stringify(inputs.priority, null, 2));
    setExample("priority");
    setSelected("route");
    setErrors([]);
    setDirty(false);
    setNotice("Example restored.");
    try {
      setWarning(save(localStorage, seed));
    } catch {
      setWarning("Local storage unavailable.");
    }
  }
  function add(type: WorkflowNode["type"]) {
    const id = crypto.randomUUID();
    const base = {
      id,
      label: `New ${type}`,
      position: {
        x: 35 + (workflow.nodes.length % 3) * 230,
        y: 36 + Math.floor(workflow.nodes.length / 3) * 148,
      },
    };
    const node: WorkflowNode =
      type === "transform"
        ? { ...base, type, operation: { kind: "uppercase", field: "customer" } }
        : type === "condition"
          ? {
              ...base,
              type,
              field: "amount",
              comparator: "greater-than",
              value: 200,
            }
          : { ...base, type };
    change({ ...workflow, nodes: [...workflow.nodes, node] });
    setSelected(id);
  }
  function download() {
    try {
      const source = exportWorkflow(workflow);
      const url = URL.createObjectURL(
        new Blob([source], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "relay-workflow.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setErrors([]);
      setNotice("Validated workflow exported.");
    } catch (error) {
      report(error);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    const generation = ++importGeneration.current;
    try {
      if (file.size > MAX_BYTES)
        throw new ValidationError(["Workflow file exceeds 128 KiB."]);
      const next = parseWorkflow(await file.text());
      if (generation !== importGeneration.current) return;
      controller.reset();
      change(next);
      setSelected(next.nodes[0].id);
      setDirty(false);
      setNotice("Workflow imported and validated.");
    } catch (error) {
      if (generation === importGeneration.current) report(error);
    }
  }
  const node = workflow.nodes.find((item) => item.id === selected);
  let valid = true;
  try {
    validateWorkflow(workflow);
  } catch {
    valid = false;
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Relay home">
          <span className="brand-mark">
            <GitBranch size={22} />
          </span>
          relay<span className="brand-suffix">/ studio</span>
        </a>
        <div className="top-meta">
          <span className="local-indicator" /> Runs locally{" "}
          <span className="separator">/</span> No account needed
        </div>
        <span className="version-pill">PLAYGROUND · V1</span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              WORKFLOWS <ChevronRight size={12} /> EXAMPLES
            </div>
            <h1>Make the next move.</h1>
            <p>Build a path. Send a payload. See every decision.</p>
          </div>
          <div className="document-actions">
            <button
              disabled={running}
              onClick={() => fileInput.current?.click()}
            >
              <ArrowUpFromLine size={15} /> Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="Import workflow JSON"
              onChange={(event) => {
                void importFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button disabled={running} onClick={download}>
              <ArrowDownToLine size={15} /> Export JSON
            </button>
          </div>
        </div>
        {warning && (
          <div role="status" className="banner warning">
            {warning}
          </div>
        )}
        {errors.length > 0 && (
          <div role="alert" className="banner error">
            <strong>Check your workflow</strong>
            <ul>
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
            <span>Your graph and last run have been preserved.</span>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        <div className="studio">
          <aside className="library panel">
            <div className="panel-heading">
              BUILDING BLOCKS<span>04</span>
            </div>
            <fieldset disabled={running}>
              <div className="node-library">
                {types.map((item) => (
                  <button
                    className={`library-item ${item.type}`}
                    key={item.type}
                    disabled={
                      workflow.nodes.length >= 40 ||
                      (item.type === "trigger" &&
                        workflow.nodes.some((n) => n.type === "trigger"))
                    }
                    onClick={() => add(item.type)}
                    aria-label={`Add ${item.type}`}
                  >
                    <span className="library-icon">
                      <item.icon size={17} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <Plus size={13} />
                  </button>
                ))}
              </div>
              <div className="library-tip">
                Add a block, then connect it in the inspector.
              </div>
              <div className="input-section">
                <div className="panel-heading">
                  TEST PAYLOAD
                  <span>
                    <Terminal size={13} />
                  </span>
                </div>
                <label>
                  Example input
                  <select
                    aria-label="Example input"
                    value={example}
                    onChange={(event) => {
                      setExample(event.target.value);
                      setInput(
                        JSON.stringify(
                          inputs[event.target.value as keyof typeof inputs],
                          null,
                          2,
                        ),
                      );
                      setDirty(run.status !== "idle");
                      importGeneration.current++;
                    }}
                  >
                    <option value="custom" disabled>
                      Custom input
                    </option>
                    <option value="priority">High-value order</option>
                    <option value="standard">Standard order</option>
                    <option value="failure">Missing customer · fails</option>
                  </select>
                </label>
                <label className="json-label">
                  Input JSON
                  <textarea
                    spellCheck={false}
                    value={input}
                    maxLength={MAX_BYTES}
                    onChange={(event) => {
                      setExample("custom");
                      setInput(event.target.value);
                      setDirty(run.status !== "idle");
                      importGeneration.current++;
                    }}
                  />
                </label>
                <p className="hint">
                  A shallow JSON object. All execution stays in this browser.
                </p>
              </div>
            </fieldset>
            <div className="library-footer">
              <span className="tiny-dot" /> PRIVATE BY DESIGN
              <br />
              <small>No services. No API keys.</small>
            </div>
          </aside>
          <section className="workbench panel" aria-label="Workflow editor">
            <div className="workbench-heading">
              <div>
                <label className="workflow-name">
                  Workflow name
                  <input
                    disabled={running}
                    value={workflow.name}
                    maxLength={160}
                    onChange={(event) =>
                      change({ ...workflow, name: event.target.value })
                    }
                  />
                </label>
                <div className="workflow-meta">
                  <span className={valid ? "valid-text" : "invalid-text"}>
                    {valid ? <Check size={12} /> : null}
                    {valid ? "Valid workflow" : "Needs connections"}
                  </span>
                  <span>
                    {workflow.nodes.length} nodes · {workflow.edges.length}{" "}
                    edges
                  </span>
                </div>
              </div>
              <div className="view-toggle">
                <button
                  onClick={() => setList(false)}
                  aria-label="Graph view"
                  aria-pressed={!list}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setList(true)}
                  aria-label="List view"
                  aria-pressed={list}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
            <Graph
              workflow={workflow}
              selected={selected}
              select={setSelected}
              run={run}
              list={list}
            />
            <div className="canvas-legend">
              <span>
                <i className="legend-line" /> Executed path
              </span>
              <span>Select any node to inspect</span>
            </div>
            <div className="run-toolbar">
              <div>
                <span
                  className={`run-status ${run.status}`}
                  data-testid="run-status"
                >
                  {run.status === "idle" ? "Ready to run" : run.status}
                </span>
                <p>
                  {dirty
                    ? "Edited since this captured run. Run again to update."
                    : run.status === "idle"
                      ? "Your input. One clear route."
                      : `${run.steps.length} steps captured${run.result ? ` · ${run.result.skipped.length} skipped` : ""}`}
                </p>
              </div>
              <div className="run-actions">
                <button
                  className="reset-button"
                  onClick={reset}
                  aria-label="Reset example"
                >
                  <RotateCcw size={16} />
                </button>
                {running ? (
                  <button
                    className="run-button stop"
                    onClick={() => controller.cancel()}
                  >
                    <Square size={14} /> Cancel run
                  </button>
                ) : (
                  <button className="run-button" onClick={start}>
                    <Play size={15} fill="currentColor" /> Run workflow
                  </button>
                )}
              </div>
            </div>
            <div className="trace">
              <div className="panel-heading">
                EXECUTION TRACE
                <span>
                  {run.steps.length
                    ? `${run.steps.length} STEPS`
                    : "AWAITING INPUT"}
                </span>
              </div>
              {run.steps.length ? (
                <ol>
                  {run.steps.map((step, i) => (
                    <li key={step.nodeId}>
                      <button
                        onClick={() => setSelected(step.nodeId)}
                        aria-label={`Inspect step ${step.label}`}
                      >
                        <span className="trace-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <strong>{step.label}</strong>
                        <span
                          className={step.error ? "error-text" : "valid-text"}
                        >
                          {step.error
                            ? "failed"
                            : step.branch
                              ? `→ ${step.branch}`
                              : "complete"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="trace-empty">
                  The story of your payload will appear here.
                </p>
              )}
            </div>
          </section>
          <Inspector
            key={selected}
            node={node}
            workflow={workflow}
            step={run.steps.find((step) => step.nodeId === selected)}
            disabled={running}
            update={(updated) =>
              change({
                ...workflow,
                nodes: workflow.nodes.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              })
            }
            remove={() => {
              change(deleteNode(workflow, selected));
              setSelected("");
            }}
            connect={(target, branch) =>
              change(connect(workflow, selected, target, branch))
            }
          />
        </div>
        <footer className="footer">
          <span>RELAY / A small engine for big what-ifs.</span>
          <span>Deterministic execution. Visible decisions.</span>
        </footer>
      </main>
    </div>
  );
}
