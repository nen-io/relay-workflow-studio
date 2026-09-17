# Relay visual design

Relay is a workflow workbench, framed as a precision instrument. A dark ink field and restrained lime accent make the executed path the strongest signal. Warm off-white typography and lavender transforms distinguish hierarchy without relying on color alone. System fonts keep the interface private, fast and self contained.

The desktop has a compact identity bar, a contextual workflow header, then three areas: a slim node library with input editor; the graph with a top view toggle and bottom execution trace; and a persistent node inspector. The graph starts from a real order-routing example: receive → normalize → compare amount → priority or standard output. Nodes are native buttons with explicit status and type text. Connecting is performed through labelled inspector selects, avoiding a drag-only interaction. Dragging node positions is optional; numeric layout controls provide the same ability.

Primary journey: inspect the preselected condition, edit its threshold or the input amount, run, follow the highlighted path, and inspect immutable step payloads. The last successful execution stays visible if a subsequent graph/input validation fails. A failure example intentionally misses a field. The stop control cancels presentation and reset invalidates every pending callback. Export and import operate on a bounded versioned JSON document.

States: empty selection explains what to select; invalid graphs show actionable issue lists; running disables every editing field; cancelled traces retain only revealed steps; unvisited nodes are labelled skipped after completion. Import and local storage failures display a warning without replacing current graph. No fabricated usage metrics appear.

Below 1050px the library and inspector stack around the workbench; below 680px the graph becomes the labelled node list, preserving all editing controls. Native form controls, visible lime focus rings, readable line heights and content wrapping support keyboard and zoom. Reduced motion removes transitions and reveals execution immediately. The same state machine and snapshots apply at every size.
