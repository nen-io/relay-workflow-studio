# Security model

## Scope and assets

Relay runs in one browser with synthetic starter data. Assets are the user's current workflow, its local saved copy, input payload and execution snapshots. There is no application server, account system, remote executor, API token or telemetry collector. This avoids application-level server authorization and job execution threats, but does not make imported JSON or browser storage trustworthy.

The browser origin, static hosting provider, npm/build supply chain and the user's installed extensions are trust boundaries. Attackers may supply malformed JSON files, dangerous property names, malicious-looking text, huge inputs, corrupt persisted data, or a graph designed to loop. This demo does not defend against a compromised device, a malicious extension or a replaced same-origin application bundle.

| Threat                                         | Implemented mitigation                                                                                                                        | Evidence                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Script/HTML injection through labels or values | React text rendering only; no unsafe HTML or dynamic script evaluation                                                                        | Browser test inserts an HTML-like label and verifies no image element is created |
| Prototype pollution                            | Forbidden `__proto__`, `constructor`, `prototype` keys and field names; shallow payloads; explicit transforms                                 | Unit tests exercise each name and nested properties                              |
| Arbitrary code execution                       | Finite operation enum; no eval, Function or script import                                                                                     | Structural operation guards, typed engine and source review                      |
| Infinite work/cycles                           | DAG validation before execution; 40-node and 80-edge limits                                                                                   | Cycle, reachability, branch and size tests                                       |
| Memory/CPU exhaustion                          | 128 KiB file/text bound before JSON parse; 100 scalar fields; 4096-character strings; bounded nesting; uppercase and assignment output bounds | Unit and browser oversized/malformed input tests                                 |
| Arithmetic corruption                          | Finite operands and result checks; no silent string conversion                                                                                | Overflow, wrong-type and direct Infinity tests                                   |
| Stale asynchronous result                      | Captured execution data, run generation fencing, import generation checks                                                                     | Cancellation/reset/rerun tests; import logic review                              |
| Corrupt/unavailable storage                    | Validate restore, visible fallback; save failure does not crash editor                                                                        | Domain and browser storage-denial tests                                          |
| Exfiltration from imported content             | No fetch, tracking, remote rendering or network APIs; production CSP `connect-src 'none'`                                                     | Production policy verification and code review                                   |

## Browser policy

`vite.config.ts` injects production-only meta CSP: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`.

Inline styles are needed by numeric node positioning. They do not authorize inline scripts. The development server has no equivalent policy because Vite HMR needs its own development runtime. Meta CSP cannot enforce `frame-ancestors`; the static host would need an HTTP header for anti-framing. Hosting should supply HTTPS. The app itself neither configures TLS nor claims to protect the hosting account. Same-origin malicious scripts would already be inside the trust boundary.

## Persistence and privacy

Only validated workflows are stored at `relay.workflow.v1`. Payload inputs and traces stay in memory. Browser local storage is not encrypted, is readable by same-origin scripts and is not a vault. Do not enter secrets. There is no cross-tab consistency protocol; last valid save wins. Clearing site storage removes saved drafts. Import/export is explicit and local; imported content is never sent to third-party servers.

## Dependencies and residual risk

Dependencies are pinned and locked; `npm ci` is the expected reproducible install. The implementation install reported zero known vulnerabilities at that moment; that is not a security audit and is not a future guarantee. Keep dependency updates reviewed and rerun the contract suite. Tests cover concrete inputs and races, not every browser, malicious file or supply-chain scenario.

A future real automation service would need authenticated identities, per-tenant authorization, secret isolation, SSRF-resistant egress, durable job queues, quotas, audit trails, rate limiting, operational monitoring and sandboxed workers. None is present or implied here.

## Reporting

Use the repository's private vulnerability reporting feature if enabled. Otherwise contact the repository owner through their public GitHub profile to arrange a private channel; do not disclose exploit details or sensitive data in public issues. No contact address is invented by this example. Include affected revision, reproduction steps and expected/actual behavior with synthetic data.

## Drag/drop input

A drop is untrusted data, even with the custom MIME type. Only exact trigger/transform/condition/output strings are accepted; no transferred HTML, JSON, file or URL is executed or fetched. Both drop and click share the 40-node and single-trigger guards. Pointer-derived coordinates are rounded and clamped to 0–3000. Running locks position mutations. Drag preview never writes storage; failed/cancelled gestures preserve the saved workflow. Starting direct manipulation invalidates pending imports so an older file cannot replace newer user intent.

Measured node heights use a Map because imported node IDs are arbitrary strings. Prototype-like IDs remain data and cannot alter the lookup prototype or produce inherited nonnumeric geometry. Browser regressions cover the import seam.


## Reversible graph editing — September 2026

Undo history never bypasses validation: run, export and local persistence keep their existing graph and byte boundaries. History stores only workflow data in memory, without payloads or traces, and disappears on reload. New text intent and history navigation fence asynchronous file reads. Resource links are fixed repository destinations with `rel="noreferrer"`; they carry no editor data.
