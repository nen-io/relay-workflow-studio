import { useEffect, useReducer, useRef, useState } from "react";
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
  Undo2,
  Redo2,
  SlidersHorizontal,
  Square,
  Terminal,
} from "lucide-react";
import { BLOCK_MIME, Graph } from "./components/Graph";
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
import { historyReducer, initialHistory } from "./domain/history";
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
  const [history, dispatch] = useReducer(
    historyReducer,
    initial.workflow,
    initialHistory,
  );
  const workflow = history.current;
  const savedWorkflow = useRef(initial.workflow);
  const editGroup = useRef<number | null>(null);
  const groupSequence = useRef(0);
  const [inspectorRevision, setInspectorRevision] = useState(0);
  const [warning, setWarning] = useState(initial.warning);
  const [selected, setSelected] = useState(() =>
    initial.workflow.nodes.some((node) => node.id === "route")
      ? "route"
      : (initial.workflow.nodes[0]?.id ?? ""),
  );
  const [example, setExample] = useState("priority");
  const [input, setInput] = useState(JSON.stringify(inputs.priority, null, 2));
  const [run, setRun] = useState<RunState>({ status: "idle", steps: [] });
  const [controller] = useState(() => new RunController(setRun));
  const [errors, setErrors] = useState<string[]>([]);
  const [list, setList] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const importGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const payloadInput = useRef<HTMLTextAreaElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const reportDestination = useRef<"summary" | "input">("summary");
  const [inputInvalid, setInputInvalid] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const pendingInspectorFocus = useRef(false);
  function requestInspectorFocus() {
    pendingInspectorFocus.current = true;
    setFocusRequest((value) => value + 1);
  }
  function editNode(id: string) {
    setSelected(id);
    requestInspectorFocus();
  }
  function backToWorkflow() {
    const target = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-node-id]"),
    ].find((item) => item.dataset.nodeId === selected);
    (target ?? document.getElementById("workflow-name"))?.focus();
  }
  useEffect(() => {
    if (!pendingInspectorFocus.current) return;
    pendingInspectorFocus.current = false;
    const field = document.getElementById(
      "node-name",
    ) as HTMLInputElement | null;
    (field && !field.matches(":disabled")
      ? field
      : document.getElementById("node-inspector")
    )?.focus();
  }, [selected, inspectorRevision, focusRequest]);
  useEffect(() => {
    if (errors.length)
      (reportDestination.current === "input"
        ? payloadInput.current
        : errorSummary.current
      )?.focus();
  }, [errors]);
  const running = run.status === "running";
  useEffect(
    () => () => {
      controller.dispose();
      importGeneration.current++;
    },
    [controller],
  );
  const report = (
    error: unknown,
    destination: "summary" | "input" = "summary",
  ) => {
    reportDestination.current = destination;
    setErrors(
      error instanceof ValidationError
        ? error.issues
        : [
            error instanceof Error
              ? error.message
              : "The operation could not be completed.",
          ],
    );
  };
  function change(next: Workflow) {
    importGeneration.current++;
    dispatch({ type: "edit", workflow: next, group: editGroup.current });
    setDirty(run.status !== "idle");
    setErrors([]);
    setInputInvalid(false);
    setNotice("");
  }
  useEffect(() => {
    if (savedWorkflow.current === workflow) return;
    savedWorkflow.current = workflow;
    try {
      setWarning(save(localStorage, workflow));
    } catch {
      setWarning(
        "Local storage is unavailable; export a valid graph to keep your changes.",
      );
    }
    setSelected((current) =>
      !workflow.nodes.some((node) => node.id === current)
        ? (workflow.nodes[0]?.id ?? "")
        : current,
    );
  }, [workflow]);
  function travel(type: "undo" | "redo") {
    if (
      running ||
      !(type === "undo" ? history.past.length : history.future.length)
    )
      return;
    importGeneration.current++;
    editGroup.current = null;
    dispatch({ type });
    setInspectorRevision((value) => value + 1);
    setDirty(run.status !== "idle");
    setErrors([]);
    setInputInvalid(false);
    setNotice(
      type === "undo"
        ? "Graph edit undone. Run captures are unchanged."
        : "Graph edit restored. Run captures are unchanged.",
    );
  }
  function start() {
    importGeneration.current++;
    let payload;
    try {
      payload = parsePayload(input);
      setInputInvalid(false);
    } catch (error) {
      setInputInvalid(true);
      report(error, "input");
      return;
    }
    try {
      controller.start(
        workflow,
        payload,
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
      );
      setErrors([]);
      setInputInvalid(false);
      setDirty(false);
      setNotice("");
    } catch (error) {
      report(error);
    }
  }
  function reset() {
    controller.reset();
    importGeneration.current++;
    editGroup.current = null;
    dispatch({ type: "edit", workflow: structuredClone(seed), group: null });
    setInspectorRevision((value) => value + 1);
    setCanvasRevision((value) => value + 1);
    setInput(JSON.stringify(inputs.priority, null, 2));
    setInputInvalid(false);
    setExample("priority");
    setSelected("route");
    setErrors([]);
    setInputInvalid(false);
    setDirty(false);
    setNotice("Example restored.");
    try {
      setWarning(save(localStorage, seed));
    } catch {
      setWarning("Local storage unavailable.");
    }
  }
  function add(
    type: WorkflowNode["type"],
    position?: WorkflowNode["position"],
  ) {
    if (
      running ||
      workflow.nodes.length >= 40 ||
      (type === "trigger" &&
        workflow.nodes.some((node) => node.type === "trigger"))
    )
      return;
    const id = crypto.randomUUID();
    const base = {
      id,
      label: `New ${type}`,
      position: position ?? {
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
    if (!position) requestInspectorFocus();
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
      setInputInvalid(false);
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
      editGroup.current = null;
      change(next);
      setInspectorRevision((value) => value + 1);
      setCanvasRevision((value) => value + 1);
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
    <div
      className="app-shell"
      onChangeCapture={(event) => {
        if (!(
          event.target instanceof HTMLInputElement &&
          event.target.type === "file"
        ))
          importGeneration.current++;
      }}
      onFocusCapture={(event) => {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
          editGroup.current = ++groupSequence.current;
      }}
      onBlurCapture={() => {
        editGroup.current = null;
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, textarea, select, [contenteditable]"))
          return;
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          event.key.toLowerCase() === "z"
        ) {
          event.preventDefault();
          travel(event.shiftKey ? "redo" : "undo");
        }
      }}
    >
      <a className="skip-link" href="#workflow-editor">
        Skip to workflow editor
      </a>
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
              aria-label="Undo graph edit"
              title="Undo graph edit (Ctrl/Cmd+Z outside text fields)"
              disabled={running || !history.past.length}
              onClick={() => travel("undo")}
            >
              <Undo2 size={15} /> Undo
            </button>
            <button
              aria-label="Redo graph edit"
              title="Redo graph edit (Ctrl/Cmd+Shift+Z outside text fields)"
              disabled={running || !history.future.length}
              onClick={() => travel("redo")}
            >
              <Redo2 size={15} /> Redo
            </button>
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
        <nav className="workspace-jumps" aria-label="Studio sections">
          <a href="#workflow-editor">Workflow</a>
          <button onClick={() => requestInspectorFocus()}>
            Edit selected node
          </button>
          <a href="#run-controls">Run and trace</a>
          <span>
            Try the sample: run it, select a node, then change a value and run
            again.
          </span>
        </nav>
        {warning && (
          <div role="status" className="banner warning">
            {warning}
          </div>
        )}
        {errors.length > 0 && (
          <div
            ref={errorSummary}
            id="workflow-errors"
            tabIndex={-1}
            role="alert"
            className="banner error"
          >
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
                    draggable={
                      !running &&
                      workflow.nodes.length < 40 &&
                      !(
                        item.type === "trigger" &&
                        workflow.nodes.some((node) => node.type === "trigger")
                      )
                    }
                    onDragStart={(event) => {
                      if (event.currentTarget.disabled || running) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.setData(BLOCK_MIME, item.type);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
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
                Click or drag a block onto the canvas, then connect it in the
                inspector.
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
                      setInputInvalid(false);
                      setErrors([]);
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
                    ref={payloadInput}
                    aria-label="Input JSON"
                    aria-invalid={inputInvalid}
                    aria-describedby={
                      inputInvalid
                        ? "payload-help workflow-errors"
                        : "payload-help"
                    }
                    spellCheck={false}
                    value={input}
                    maxLength={MAX_BYTES}
                    onChange={(event) => {
                      setExample("custom");
                      setInputInvalid(false);
                      setInput(event.target.value);
                      setDirty(run.status !== "idle");
                      importGeneration.current++;
                    }}
                  />
                </label>
                <p className="hint" id="payload-help">
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
          <section
            id="workflow-editor"
            tabIndex={-1}
            className="workbench panel"
            aria-label="Workflow editor"
          >
            <div className="workbench-heading">
              <div>
                <label className="workflow-name">
                  Workflow name
                  <input
                    id="workflow-name"
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
              key={canvasRevision}
              workflow={workflow}
              selected={selected}
              select={setSelected}
              edit={editNode}
              run={run}
              list={list}
              add={add}
              onEditStart={() => {
                importGeneration.current++;
              }}
              move={(id, position) => {
                if (running) return;
                change({
                  ...workflow,
                  nodes: workflow.nodes.map((item) =>
                    item.id === id ? { ...item, position } : item,
                  ),
                });
              }}
            />
            <div className="canvas-legend">
              <span>
                <i className="legend-line" /> Executed path
              </span>
              <span>Select any node to inspect</span>
            </div>
            <div
              className="run-toolbar"
              id="run-controls"
              tabIndex={-1}
              role="region"
              aria-label="Run and trace"
            >
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
                        onClick={() => editNode(step.nodeId)}
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
            key={`${selected}:${inspectorRevision}`}
            node={node}
            workflow={workflow}
            step={run.steps.find((step) => step.nodeId === selected)}
            disabled={running}
            back={backToWorkflow}
            update={(updated) =>
              change({
                ...workflow,
                nodes: workflow.nodes.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              })
            }
            remove={() => {
              const next = deleteNode(workflow, selected);
              change(next);
              setSelected(next.nodes[0]?.id ?? "");
              requestInspectorFocus();
            }}
            connect={(target, branch) =>
              change(connect(workflow, selected, target, branch))
            }
          />
        </div>
        <footer className="footer">
          <span>RELAY / A small engine for big what-ifs.</span>
          <nav className="review-links" aria-label="Project resources">
            <a
              href="https://github.com/nen-io/relay-workflow-studio"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
            <a
              href="https://github.com/nen-io/relay-workflow-studio/blob/main/docs/REVIEWER_GUIDE.md"
              target="_blank"
              rel="noreferrer"
            >
              Engineering walkthrough
            </a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
