# Scalability and resource design

## What is implemented

This is a bounded single-user browser engine. Each accepted document has at most 40 nodes, 80 edges and 128 KiB of UTF-8 JSON; each payload has at most 100 fields with strings ≤4096 characters. Coordinate values are finite and bounded to 3000; structural nesting is capped at 12. The interface disables adding a 41st node; import/run independently enforce domain limits. Uppercase cannot expand beyond the string bound, assignment cannot add a 101st field, and arithmetic cannot emit Infinity.

An invalid or oversized workflow is rejected before execution and does not overwrite the active graph on import. A graph temporarily invalid during editing stays visible but cannot run or export. Storage quota failure leaves editing available and displays a warning. These are intentional overload semantics, not automatic unbounded buffering.

## Cost model

Let V = node count, E = edge count, P = payload size and K = visited path length.

- JSON parsing/validation is O(document bytes). The structural forbidden-key walk has bounded depth. Graph adjacency construction and DFS in `validateWorkflow` are O(V+E) time and space.
- Execution currently builds adjacency with one edge filter per node: O(VE), bounded by 3200 edge checks. It deliberately favors readability at this size; a one-pass map is the first straightforward optimization if limits rise.
- Each visited node snapshots the payload. Cost is O(KP) time and retained space. Scalar fields avoid arbitrary graph cloning depth. A complete path cannot visit more than V nodes.
- Current skipped-node derivation and render lookups use linear array searches, making some UI/domain work O(V² + VE). With V≤40 this is an explicit simplicity tradeoff, not an unmeasured promise of large-graph performance.
- Native node buttons and SVG edges render O(V+E) elements. A large browser canvas can reduce readability before CPU is a bottleneck; the list view preserves access.
- Every valid edit serializes and writes the current workflow synchronously to local storage. At the cap, synchronous storage is an interaction bottleneck to measure before increasing limits.

No throughput, latency or memory benchmark was performed. Test durations are correctness-run observations, not capacity measurements. Hardware-dependent performance claims are intentionally absent.

## 10× proposal, not implemented

Before admitting 400 nodes, collect production-build profiles for editing, validation and execution using a published fixture and browser/hardware specification. Build adjacency and reverse indexes once, cache them by immutable workflow revision, and avoid repeated linear lookups. Debounce persistence using a revision fence; move storage to IndexedDB and retain a recoverable draft separate from the last valid executable workflow. Virtualize the node list and trace, provide search, and use canvas viewport culling. Reduce-motion and keyboard alternatives remain mandatory. A Web Worker can isolate long validation/execution from rendering; the worker protocol must include run generation and cancellation tokens.

Snapshot memory is the likely next limit: store bounded payload diffs plus checkpoints, keep a measured retention budget, and surface truncation explicitly. Do not silently discard steps. An immutable validated workflow revision becomes the cache key; edits invalidate its derived graph.

## 100× / service proposal, not implemented

At thousands of nodes and concurrent users, do not lift the browser cap without changing the product model. Store versioned workflow revisions in a database, execute immutable revisions in isolated workers, enqueue durable jobs, apply per-user admission quotas and bound job time/payload sizes. External effects require idempotency keys and explicit retry semantics; current pure local transforms do not need a distributed delivery guarantee.

Persist append-only execution events with a monotonic sequence per run. Consumers resume by sequence rather than expecting exactly-once transport. Partition jobs by tenant or workflow as load and fairness demand. Authenticate every mutation and artifact read; make tenant isolation explicit. Cache only immutable revisions, not mutable draft responses. Backpressure should reject or defer new work with clear status instead of exhausting worker memory. Queue depth, failed jobs and retained event bytes become operational measurements.

## Consistency now

Run input and workflow are cloned once at start. Edits are disabled during the run. Timer generations invalidate cancelled/reset work. Imported files are accepted only if no newer edit/run/reset has superseded their read. The local draft is last-writer-wins across tabs; there is no collaborative editing or database transaction claim. Export is the portable backup mechanism. All larger-scale designs above are proposals, clearly separate from current behavior.
