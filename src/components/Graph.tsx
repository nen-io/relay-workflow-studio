import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDownToLine,
  GitBranch,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import type { RunState } from "../domain/engine";
import type { Workflow, WorkflowNode } from "../domain/workflow";

export const BLOCK_MIME = "application/x-relay-block";
export const nodeIcons = {
  trigger: Radio,
  transform: SlidersHorizontal,
  condition: GitBranch,
  output: ArrowDownToLine,
};
type Position = WorkflowNode["position"];
const clamp = (value: number) => Math.round(Math.max(0, Math.min(3000, value)));
export function description(node: WorkflowNode): string {
  if (node.type === "transform")
    return `${node.operation.kind} · ${node.operation.field}`;
  if (node.type === "condition")
    return `${node.field} ${node.comparator === "equals" ? "=" : ">"} ${JSON.stringify(node.value)}`;
  return node.type === "trigger" ? "Manual trigger" : "Workflow destination";
}
interface Gesture {
  id: string;
  pointer: number;
  element: HTMLButtonElement;
  start: Position;
  grab: Position;
  client: Position;
  position: Position;
  moved: boolean;
  viewport: Position;
}

export function Graph({
  workflow,
  selected,
  select,
  run,
  list,
  move,
  add,
  onEditStart,
}: {
  workflow: Workflow;
  selected: string;
  select: (id: string) => void;
  run: RunState;
  list: boolean;
  move: (id: string, position: Position) => void;
  add: (type: WorkflowNode["type"], position: Position) => void;
  onEditStart: () => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    position: Position;
  } | null>(null);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [extent, setExtent] = useState({ width: 760, height: 655 });
  const [dropTarget, setDropTarget] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const running = run.status === "running";
  const nodes = workflow.nodes.map((node) =>
    preview?.id === node.id ? { ...node, position: preview.position } : node,
  );
  // CSS pixels are canvas units. Scrolling never changes a saved position, and
  // resizing the viewport cannot rescale the graph underneath the pointer.
  const width = Math.max(
    extent.width,
    ...workflow.nodes.map((node) => node.position.x + 240),
    ...nodes.map((node) => node.position.x + 240),
  );
  const height = Math.max(
    extent.height,
    ...workflow.nodes.map(
      (node) => node.position.y + (heights.get(node.id) ?? 110) + 35,
    ),
    ...nodes.map(
      (node) => node.position.y + (heights.get(node.id) ?? 110) + 35,
    ),
  );
  useLayoutEffect(() => {
    setExtent((previous) =>
      previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, [width, height]);
  function cancel() {
    const active = gesture.current;
    gesture.current = null;
    setPreview(null);
    if (active?.element.hasPointerCapture(active.pointer))
      active.element.releasePointerCapture(active.pointer);
  }
  useEffect(() => {
    cancel();
    setDropTarget(false);
  }, [workflow, list, running]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture.current) {
        event.preventDefault();
        cancel();
        setAnnouncement("Move cancelled.");
      }
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
    };
  }, []);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const measure = () => {
      const next = new Map<string, number>();
      element.querySelectorAll<HTMLButtonElement>(".node").forEach((node) => {
        next.set(node.dataset.nodeId!, node.getBoundingClientRect().height);
      });
      setHeights((previous) =>
        previous.size === next.size &&
        [...next].every(([id, height]) => previous.get(id) === height)
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    element.querySelectorAll(".node").forEach((node) => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [workflow.nodes, list]);
  const graphical = (element: HTMLElement) =>
    !list && getComputedStyle(element).position === "absolute";
  function begin(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: WorkflowNode,
  ) {
    if (
      running ||
      !event.isPrimary ||
      event.button !== 0 ||
      gesture.current ||
      !graphical(event.currentTarget)
    )
      return;
    const rect = canvas.current!.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    select(node.id);
    onEditStart();
    gesture.current = {
      id: node.id,
      pointer: event.pointerId,
      element: event.currentTarget,
      start: { x: event.clientX, y: event.clientY },
      client: { x: event.clientX, y: event.clientY },
      grab: {
        x: event.clientX - rect.left - node.position.x,
        y: event.clientY - rect.top - node.position.y,
      },
      position: node.position,
      moved: false,
      viewport: { x: window.innerWidth, y: window.innerHeight },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function update(client?: Position) {
    const active = gesture.current;
    if (!active || !canvas.current) return;
    // A viewport resize may reach pointerup before its queued resize event.
    if (
      active.viewport.x !== window.innerWidth ||
      active.viewport.y !== window.innerHeight
    ) {
      cancel();
      return;
    }
    if (client) active.client = client;
    if (
      !active.moved &&
      Math.hypot(
        active.client.x - active.start.x,
        active.client.y - active.start.y,
      ) < 4
    )
      return;
    active.moved = true;
    const rect = canvas.current.getBoundingClientRect();
    active.position = {
      x: clamp(active.client.x - rect.left - active.grab.x),
      y: clamp(active.client.y - rect.top - active.grab.y),
    };
    setPreview({ id: active.id, position: active.position });
  }
  function finish(event: ReactPointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    update({ x: event.clientX, y: event.clientY });
    if (gesture.current !== active) return;
    cancel();
    if (active.moved) {
      move(active.id, active.position);
      setAnnouncement(
        `Node moved to ${active.position.x}, ${active.position.y}.`,
      );
    }
  }
  const seen = new Set(run.steps.map((step) => step.nodeId));
  const end = ["completed", "failed"].includes(run.status);
  return (
    <>
      <p id="canvas-help" className="canvas-help">
        Drag nodes to arrange. Arrow keys move a focused node; Shift moves 10px.
        Escape cancels. Drop a building block to add it.
      </p>
      <div
        className={`graph ${list ? "list-mode" : ""} ${dropTarget ? "drop-target" : ""}`}
        role="region"
        aria-label="Workflow canvas"
        tabIndex={0}
        onScroll={() => update()}
        onDragOver={(event) => {
          if (
            !running &&
            !list &&
            !matchMedia("(max-width: 760px)").matches &&
            event.dataTransfer.types.includes(BLOCK_MIME)
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropTarget(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropTarget(false);
        }}
        onDrop={(event) => {
          setDropTarget(false);
          if (
            running ||
            list ||
            matchMedia("(max-width: 760px)").matches ||
            !event.dataTransfer.types.includes(BLOCK_MIME)
          )
            return;
          event.preventDefault();
          const type = event.dataTransfer.getData(BLOCK_MIME);
          if (
            type !== "trigger" &&
            type !== "transform" &&
            type !== "condition" &&
            type !== "output"
          )
            return;
          const rect = canvas.current!.getBoundingClientRect();
          add(type, {
            x: clamp(event.clientX - rect.left - 110),
            y: clamp(event.clientY - rect.top - 45),
          });
        }}
      >
        <div
          ref={canvas}
          className="canvas"
          style={{ minWidth: width, minHeight: height }}
        >
          <svg className="connections" aria-hidden="true">
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
              const from = nodes.find((node) => node.id === edge.source),
                to = nodes.find((node) => node.id === edge.target);
              if (!from || !to) return null;
              const x1 = from.position.x + 110,
                y1 = from.position.y + (heights.get(from.id) ?? 102),
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
          {nodes.map((node, index) => {
            const Icon = nodeIcons[node.type],
              step = run.steps.find((item) => item.nodeId === node.id);
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
                data-node-id={node.id}
                className={`node ${node.type} ${selected === node.id ? "selected" : ""} ${status} ${preview?.id === node.id ? "dragging" : ""} ${running ? "locked" : ""}`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  width: 220,
                }}
                onClick={() => select(node.id)}
                aria-pressed={selected === node.id}
                aria-label={`Inspect ${node.label}`}
                aria-describedby="canvas-help"
                onPointerDown={(event) => begin(event, node)}
                onPointerMove={(event) => {
                  if (gesture.current?.pointer === event.pointerId)
                    update({ x: event.clientX, y: event.clientY });
                }}
                onPointerUp={finish}
                onPointerCancel={cancel}
                onLostPointerCapture={cancel}
                onKeyDown={(event) => {
                  if (
                    running ||
                    gesture.current ||
                    !graphical(event.currentTarget) ||
                    event.altKey ||
                    event.metaKey ||
                    event.ctrlKey
                  )
                    return;
                  const directions: Record<string, Position> = {
                    ArrowLeft: { x: -1, y: 0 },
                    ArrowRight: { x: 1, y: 0 },
                    ArrowUp: { x: 0, y: -1 },
                    ArrowDown: { x: 0, y: 1 },
                  };
                  const direction = directions[event.key];
                  if (!direction) return;
                  event.preventDefault();
                  onEditStart();
                  const amount = event.shiftKey ? 10 : 1;
                  const position = {
                    x: clamp(node.position.x + direction.x * amount),
                    y: clamp(node.position.y + direction.y * amount),
                  };
                  select(node.id);
                  move(node.id, position);
                  setAnnouncement(
                    `Node moved to ${position.x}, ${position.y}.`,
                  );
                }}
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
      <span className="sr-only" role="status" aria-label="Canvas updates">
        {announcement}
      </span>
    </>
  );
}
