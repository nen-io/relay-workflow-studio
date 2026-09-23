# A three-minute engineering review

Relay is a new AI-assisted portfolio demonstration of interactive product engineering. Its TypeScript engine runs real bounded workflows in the browser; the example orders are synthetic. It is not a hosted automation service and has no external side effects.

## Try the behavior

Open the [public demo](https://nen-io.github.io/relay-workflow-studio/) and choose **Run workflow**. The default amount of 320 reaches Priority queue. Select **High-value order?**, change **Compare value** from 200 to 400, apply the field, and rerun. The same payload now reaches Standard queue. Select a captured step to inspect its immutable input/output snapshot.

The useful review question is whether the run consistently reflects the workflow and input captured when it started, even when asynchronous callbacks finish later. The application disables conflicting controls during a run, supports cancellation, and separates the domain engine from React rendering.

Drag the selected node, then choose **Undo** and **Redo**. Each completed gesture is one edit; changing a connection or deleting a node is also reversible. Text typing is grouped by field focus. History belongs to the graph: the captured execution and input are never rewound. See [history browser journeys](../tests/e2e/history.spec.ts) and [snapshot invariants](../tests/unit/history.test.ts).

![Current studio with reversible graph edits](screenshots/desktop.png)

## Read the evidence

- [Engine, persistence and cancellation tests](../tests/unit/) exercise behavior independently of the UI.
- [Browser journeys](../tests/e2e/relay.spec.ts) cover edits, routing, failures, imports and keyboard/pointer interaction.
- [Architecture](ARCHITECTURE.md) explains graph validation and execution.
- [Decisions](DECISIONS.md) records tradeoffs; [testing](TESTING.md) records actual checks and limitations.

Use Node 24, then `npm ci` and `npm run check`. Browser journeys additionally require the documented Chromium installation and `npm run test:e2e`.

## Boundary to discuss

Persistence accepts complete valid graphs, while partially connected edits remain only in the open tab. A production workflow service would also need authentication, durable scheduling, delivery semantics and a reviewed external-action boundary. Those capabilities are deliberately absent here. Test counts are evidence of the declared cases, not a substitute for production operating history.
