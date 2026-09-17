import { exportWorkflow, parseWorkflow, type Workflow } from "./workflow";
export const STORAGE_KEY = "relay.workflow.v1";
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export function restore(
  storage: StoragePort,
  fallback: Workflow,
): { workflow: Workflow; warning: string } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return {
      workflow: raw ? parseWorkflow(raw) : structuredClone(fallback),
      warning: "",
    };
  } catch {
    return {
      workflow: structuredClone(fallback),
      warning:
        "Saved draft could not be restored. The example is loaded; editing still works.",
    };
  }
}
export function save(storage: StoragePort, workflow: Workflow): string {
  try {
    storage.setItem(STORAGE_KEY, exportWorkflow(workflow));
    return "";
  } catch {
    return "Draft is not saved: storage is unavailable or the graph needs validation. Export a valid graph to keep a copy.";
  }
}
