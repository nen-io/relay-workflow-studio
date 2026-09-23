import type { Workflow } from "./workflow";

export const MAX_HISTORY = 50;
export interface History {
  current: Workflow;
  past: Workflow[];
  future: Workflow[];
  group: number | null;
}
type Action =
  | { type: "edit"; workflow: Workflow; group: number | null }
  | { type: "undo" | "redo" };

export function initialHistory(current: Workflow): History {
  return { current, past: [], future: [], group: null };
}
// Drafts can contain NaN while a numeric field is empty. JSON equality would
// conflate that with null, so compare the bounded, plain workflow tree directly.
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = Object.keys(a),
    right = Object.keys(b);
  return (
    left.length === right.length &&
    left.every(
      (key) =>
        Object.hasOwn(b, key) &&
        equal(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}
/** Immutable graph snapshots only; execution and transient input have separate authority. */
export function historyReducer(state: History, action: Action): History {
  if (action.type === "edit") {
    if (equal(state.current, action.workflow)) return state;
    return {
      current: action.workflow,
      past:
        action.group !== null && action.group === state.group
          ? state.past
          : [...state.past, state.current].slice(-MAX_HISTORY),
      future: [],
      group: action.group,
    };
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous
      ? {
          current: previous,
          past: state.past.slice(0, -1),
          future: [state.current, ...state.future],
          group: null,
        }
      : state;
  }
  const next = state.future[0];
  return next
    ? {
        current: next,
        past: [...state.past, state.current],
        future: state.future.slice(1),
        group: null,
      }
    : state;
}
