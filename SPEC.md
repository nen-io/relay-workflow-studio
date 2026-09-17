# Relay — Visual workflow studio

This document defines the behavior and acceptance criteria. All demonstration data is synthetic. The demo runs without a login or API key.

## Product and visual design

A dark ink canvas with lime execution paths, a narrow node library and a substantial inspector. The graph is the main visual, not cards of fake statistics. A labelled list view provides the same editing and connection actions without dragging. Start with a useful order-routing workflow. Use real editable nodes and connections; a decorative diagram is insufficient.

## Model and rules

Version 1 Workflow has id, name, nodes and edges. Node types are trigger, transform, condition and output. IDs are unique nonempty strings. Exactly one trigger; every node reachable from it; no cycles, dangling edges, duplicate edges or edges into trigger. Node/edge limits 40/80. Transforms use a finite enum (uppercase a named string field; multiply a named finite numeric field by finite factor; assign a scalar field), never eval or arbitrary code. Reject **proto**, constructor and prototype property names. Conditions compare a named field against a scalar using equals or greater-than. A condition has exactly one true and one false outgoing edge; other non-output nodes have one outgoing edge; output has none. Run selected branches only. Inputs are shallow JSON objects of scalar values. Keep a snapshot per node so later operations cannot mutate history.

## Required behavior

1. Add, edit, connect and delete nodes; connections are explicitly labelled for conditions. Delete a node removes incident edges. Drag positions may be decorative persisted layout, but connection editing must work.
2. Validate before run and surface specific errors without changing last good result. Runs have idle/running/completed/failed/cancelled state. Capture workflow/input at start. Disable editing during run or explicitly cancel before changing fixture; never execute a mixture of versions.
3. Deterministic pure engine returns path, input/output snapshots and failure node; UI step animation is presentation only. Missing/wrong-type field fails at its node. Untaken branches show skipped, not successful.
4. Cancel stops future steps; resetting or changing examples invalidates pending callbacks. Provide success and failure examples.
5. Export validated versioned JSON; import files <=128 KiB with schema errors. Bad import preserves existing workflow and results. Local saved draft validates on restore and falls back with visible warning if corrupt. Storage failures never crash editing.
6. Inspector exposes configuration, selected step input and output. Honest run counts derive from actual run state. Narrow screens switch to a readable stacked/list layout.

## Acceptance tests

- R1: seeded true and false cases visit the expected output, with the other branch skipped.
- R2: reject cycles, dangling/duplicate IDs/edges, invalid branch counts, unreachable nodes, malformed versions and forbidden property names.
- R3: valid transforms preserve earlier snapshots; missing field and nonfinite arithmetic fail explicitly.
- R4: cancel/reset prevents old timer updates and further execution; immediate rerun has only its own history.
- R5: export/import round trip preserves configuration and positions; malformed import leaves current graph intact.
- R6 browser: edit condition/input, run both branches, inspect node payload, cancel, export, reimport; keyboard connection controls and mobile layout.

## Documentation

Explain schema, supported node operations, validation order, engine/UI separation and why this is not a general automation service. Include a sample workflow JSON and a walkthrough.

## Completion gate

Implement the behavior and acceptance tests above; document any deliberate limitation. `npm run check` and `npm run test:e2e` must pass. Independently review the code and exercise the production build before release. Verify the public demo at its GitHub repository subpath.
