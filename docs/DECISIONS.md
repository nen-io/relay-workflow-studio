# Architectural decision records

## ADR 1 — Pure domain engine, React orchestration

**Context.** A visual graph can look convincing without meaningful execution. The core behavior needs to be testable without a browser and invariant under animation speed.

**Alternatives.** Execute transforms in React effects; use a full graph execution framework; define a small independent engine.

**Decision.** Use explicit TypeScript node unions, a domain validator and a pure step generator. React owns intent and rendering; `RunController` owns only step scheduling and generation fencing. Tests invoke the same engine used by the UI.

**Consequences.** Failures and immutable snapshots have one implementation. UI code must translate graph commands explicitly; there is no library-provided drag/zoom system. This is appropriate for a 40-node teaching tool.

**Revisit when.** Graph gestures, thousands of nodes or third-party operation plugins become product requirements. Preserve the domain boundary even if a canvas library replaces rendering.

## ADR 2 — Capture once; advance once per timer; persist valid graphs only

**Context.** A user can cancel, reset or edit while callbacks and file reads are pending. Saving invalid intermediate graphs could make reload fail unpredictably.

**Alternatives.** Compute all results eagerly then animate; interpret mutable live state each tick; run from a captured revision with explicit cancellation. Persist every edit or only validated graphs.

**Decision.** Clone workflow/input at start, advance a generator one step per timer and invalidate timers by generation. Persist only valid version 1 workflows; failed saves warn and leave the previous valid copy untouched. Input payloads and execution history stay in memory. Scalar text fields commit on blur/Enter so incremental edits do not corrupt JSON literals.

**Consequences.** Cancellation prevents future computations and reveal steps. Invalid partial wiring is not recovered on reload; the UI explains that tradeoff. Multiple tabs remain last-writer-wins. Import has its own generation fence to prevent an older file read overwriting a later action.

**Revisit when.** Users need crash recovery of incomplete drafts, cross-tab coordination or durable run history. Use separate draft/validated-revision stores and version checks, not a looser executable schema.

## ADR 3 — A finite transform language, no arbitrary code

**Context.** A public demo must accept untrusted files without turning the browser into a general script runner.

**Alternatives.** User-entered JavaScript, expression evaluation library, sandboxed code runner, or a finite operation enum.

**Decision.** Support uppercase, finite-number multiplication and scalar assignment only. Ban dangerous property names, require shallow scalar input and render every user label as React text. Production CSP prohibits inline scripts and network connections. No remote service or secrets exist.

**Consequences.** Behavior is explainable and tests can cover all operations. The tool cannot implement arbitrary business automation or fetch APIs. CSP is defense in depth, not a substitute for validation or safe rendering; a compromised same-origin bundle remains trusted by the browser.

**Revisit when.** A real automation service requires new integrations. Add typed operations with explicit authorization and egress policies before considering code execution. Any script capability would require a separately designed isolation boundary.

## ADR 4 — Explicit small-graph limits before optimization

**Context.** Graph validation, synchronous local storage and complete payload snapshots all consume browser resources. The demo must have predictable failure behavior.

**Alternatives.** Accept unlimited graphs, optimize prematurely with workers/virtualized canvases, or impose visible limits and document the scaling path.

**Decision.** Enforce 40 nodes, 80 edges, 128 KiB imports, 100 scalar fields and 4096-character strings. Use understandable maps/arrays and full snapshots. Validate resource limits on input and transform output. Provide a responsive list interface instead of scaling the canvas until text is unreadable.

**Consequences.** Honest limits make correctness tractable. Some render lookups and adjacency creation remain O(VE) or O(V²); these are documented and bounded, not claimed to support enterprise graphs. No fabricated benchmark numbers are presented.

**Revisit when.** Measured real workflows approach the bounds. Profile and publish fixtures first, then add indexed adjacency, revision-aware caching, IndexedDB, workers and virtualization in that order as evidence warrants.

## ADR 5 — Static hosting with self-contained assets

**Context.** A portfolio must open immediately without accounts, paid APIs or environment secrets and work at a repository subpath.

**Alternatives.** Hosted backend, third-party workflow service, or entirely static delivery.

**Decision.** Vite builds relative assets, React runs the local demo and a production meta CSP limits capabilities. System fonts, local SVG icons and synthetic inputs remove runtime third-party dependencies.

**Consequences.** Easy review and reproducibility; no claims of authentication, durable jobs, multi-tenancy or server security. The static host owns TLS and headers such as `frame-ancestors`.

**Revisit when.** Demonstrating real external effects becomes necessary. Keep the current no-key demo as an isolated preview and design the authenticated service separately.

## ADR 006 — A stable pixel plane and transient pointer gestures

**Problem.** The first studio looked draggable but exposed only position fields. Its percentage-based fitted canvas also changed scale when positions changed, which would move the coordinate system during a gesture.

**Decision.** Keep positions in CSS pixels, allow canvas scrolling, and retain the largest displayed extent until graph import/reset. Pointer capture preserves movement after leaving a button. A ref owns pointer identity, original grab offset and latest coordinates; React state renders only the current preview. Release commits one layout edit through the existing persistence boundary. Cancel paths discard preview state. Edges use observed button heights instead of a guessed bottom anchor. Existing schema limits remain authoritative.

**Alternatives.** A graph framework provides zoom/pan and connector dragging, but adds a larger interaction model and dependency for a 40-node demo. Percentage fitting is compact but destabilizes direct manipulation. This bounded native implementation supports current behavior with explicit keyboard and numeric alternatives.

**Consequences.** No automatic layout, zoom or drag-to-connect is claimed. Canvas extents may retain empty space after moving inward; reset/import rebuilds them. Large graphs require scrolling. Before raising node limits, profile pointer rendering and introduce indexed edge lookup or viewport culling if needed.

**References.** [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) explains pointer identity/capture/cancel and touch-action; [React useRef](https://react.dev/reference/react/useRef) informs transient gesture storage. Consulted 17 September 2026.
