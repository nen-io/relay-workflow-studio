import { describe, expect, it } from "vitest";
import { seed } from "../../src/domain/fixtures";
import {
  connect,
  deleteNode,
  exportWorkflow,
  MAX_BYTES,
  parsePayload,
  parseWorkflow,
  validatePayload,
  validateWorkflow,
  type Workflow,
} from "../../src/domain/workflow";
const clone = () => structuredClone(seed);
const invalid = (mutate: (workflow: Workflow) => void, message: string) => {
  const workflow = clone();
  mutate(workflow);
  expect(() => validateWorkflow(workflow)).toThrow(message);
};
describe("bounded workflow schema and graph validation", () => {
  it("round trips a real workflow including positions and configuration", () =>
    expect(parseWorkflow(exportWorkflow(seed))).toEqual(seed));
  it("rejects unsupported versions", () =>
    expect(() =>
      parseWorkflow(JSON.stringify({ ...seed, version: 2 })),
    ).toThrow("version 1"));
  it("rejects malformed JSON", () =>
    expect(() => parseWorkflow("{")).toThrow("not valid JSON"));
  it.each(["operation", "comparator"])(
    "rejects array-coerced %s enums",
    (field) => {
      const document = JSON.parse(JSON.stringify(seed));
      if (field === "operation")
        document.nodes[1].operation.kind = ["uppercase"];
      else document.nodes[2].comparator = ["equals"];
      expect(() => parseWorkflow(JSON.stringify(document))).toThrow();
    },
  );
  it("rejects duplicate node IDs", () =>
    invalid((w) => {
      w.nodes[1].id = w.nodes[0].id;
    }, "Node IDs must be unique"));
  it("rejects duplicate edge IDs", () =>
    invalid((w) => {
      w.edges[1].id = w.edges[0].id;
    }, "Edge IDs must be unique"));
  it("rejects duplicate connections", () =>
    invalid((w) => {
      w.edges.push({ ...w.edges[0], id: "another" });
    }, "Duplicate connections"));
  it("rejects dangling edges", () =>
    invalid((w) => {
      w.edges[0].target = "missing";
    }, "missing node"));
  it("rejects cycles and edges into the trigger", () =>
    invalid((w) => {
      w.edges[0].target = "receive";
    }, "cycle"));
  it("rejects unreachable nodes", () =>
    invalid((w) => {
      w.nodes.push({
        id: "orphan",
        type: "output",
        label: "Orphan",
        position: { x: 0, y: 0 },
      });
    }, "reachable"));
  it("rejects incomplete condition branches", () =>
    invalid((w) => {
      w.edges.pop();
    }, "one true and one false"));
  it("rejects branch labels on non-conditions", () =>
    invalid((w) => {
      w.edges[0].branch = "true";
    }, "only conditions"));
  it("rejects outgoing edges from an output", () =>
    invalid((w) => {
      w.edges.push({ id: "bad", source: "priority", target: "standard" });
    }, "no outgoing"));
  it("rejects multiple triggers", () =>
    invalid((w) => {
      w.nodes.push({
        id: "trigger2",
        type: "trigger",
        label: "Trigger",
        position: { x: 0, y: 0 },
      });
    }, "exactly one trigger"));
  it.each(["__proto__", "constructor", "prototype"])(
    "rejects dangerous field %s",
    (field) =>
      invalid((w) => {
        w.nodes[1] = {
          ...w.nodes[1],
          type: "transform",
          operation: { kind: "uppercase", field },
        };
      }, "forbidden field"),
  );
  it("rejects forbidden keys anywhere", () =>
    expect(() =>
      parseWorkflow(
        JSON.stringify(seed).replace(
          '"version":1',
          '"__proto__":{},"version":1',
        ),
      ),
    ).toThrow("Forbidden property"));
  it("rejects nonfinite coordinates", () =>
    invalid((w) => {
      w.nodes[0].position.x = NaN;
    }, "finite position"));
  it("rejects 41 nodes", () =>
    invalid((w) => {
      w.nodes = Array.from({ length: 41 }, () => w.nodes[0]);
    }, "1–40"));
  it("rejects 81 edges", () =>
    invalid((w) => {
      w.edges = Array.from({ length: 81 }, () => w.edges[0]);
    }, "80 edges"));
  it("rejects oversized multibyte JSON before parsing", () =>
    expect(() => parseWorkflow("é".repeat(MAX_BYTES / 2 + 1))).toThrow(
      "128 KiB",
    ));
  it("rejects excessive document nesting without recursing forever", () => {
    const nested = JSON.parse("[".repeat(14) + "0" + "]".repeat(14));
    expect(() => parseWorkflow(JSON.stringify({ ...seed, nested }))).toThrow(
      "nesting",
    );
  });
  it("removes every incident edge on node deletion", () => {
    const changed = deleteNode(seed, "route");
    expect(changed.nodes.some((n) => n.id === "route")).toBe(false);
    expect(changed.edges).toHaveLength(1);
    expect(seed.edges).toHaveLength(4);
  });
  it("replaces exactly one labelled branch through connection controls", () => {
    const changed = connect(seed, "route", "standard", "true");
    expect(changed.edges.filter((e) => e.source === "route")).toEqual(
      expect.arrayContaining([
        {
          id: "route-standard",
          source: "route",
          target: "standard",
          branch: "false",
        },
        {
          id: "route-true-standard",
          source: "route",
          target: "standard",
          branch: "true",
        },
      ]),
    );
  });
});
describe("payload trust boundary", () => {
  it("accepts scalar values and HTML-like text as text", () =>
    expect(
      parsePayload(
        '{"name":"<script>alert(1)</script>","number":0,"ok":false,"nil":null}',
      ),
    ).toEqual({
      name: "<script>alert(1)</script>",
      number: 0,
      ok: false,
      nil: null,
    }));
  it.each([
    "[]",
    "null",
    '{"nested":{}}',
    '{"x":1e999}',
    '{"__proto__":"x"}',
    '{"constructor":1}',
    '{"prototype":2}',
  ])("rejects invalid payload %s", (source) =>
    expect(() => parsePayload(source)).toThrow(),
  );
  it("rejects strings above 4096 characters", () =>
    expect(() => parsePayload(JSON.stringify({ x: "a".repeat(4097) }))).toThrow(
      "4096",
    ));
  it("rejects more than 100 fields", () =>
    expect(() =>
      parsePayload(
        JSON.stringify(
          Object.fromEntries(
            Array.from({ length: 101 }, (_, i) => [`f${i}`, i]),
          ),
        ),
      ),
    ).toThrow("100 fields"));
  it("rejects direct nonfinite values without silently serializing to null", () =>
    expect(() => validatePayload({ x: Infinity })).toThrow("finite scalar"));
});
