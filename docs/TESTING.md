# Verification record

Executed 17 September 2026 on macOS with Node 24.19.0, React 19.3.0, Vite 8.3.0, Vitest 5.0.1, Playwright 1.63.0 and bundled Chromium. This is local verification; publishing and final remote verification are separate release gates.

## Commands and actual results

| Command / check                          | Result                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run typecheck`                      | Passed strict TypeScript                                                             |
| `npm test`                               | 56 tests passed across 3 files                                                       |
| `npm run build`                          | Passed; relative asset URLs and production CSP emitted                               |
| `npm run check`                          | Passed typecheck, 56 tests and build                                                 |
| `npm run test:e2e`                       | 22 Chromium journeys passed                                                          |
| `npx prettier --check src tests`         | Passed consistent source formatting                                                  |
| Production preview on port 4401          | Order route completed with zero captured page/console errors; production CSP present |
| Root audit tool (`node audit.mjs relay`) | Zero axe violations and zero page errors; no overflow at 1440/720/390/320px          |
| Desktop / mobile captures                | Actual populated running-app screenshots at 1440px and 390px widths                  |

## Acceptance map

| Contract                          | Tests and evidence                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 true/false branches            | Engine parametrized cases plus browser threshold/input edits verify destination and skipped branch                                                                  |
| R2 invalid graph/schema           | Version, shape, duplicate IDs/edges, dangling edges, cycles, reachability, branch counts, dangerous fields, node/edge bounds and nesting                            |
| R3 immutable snapshots / failures | Snapshot mutation isolation, captured input/config, missing/wrong-type fields, multiply overflow, assignment and uppercase limits                                   |
| R4 cancellation / races           | Fake-clock cancel, reset, immediate rerun and disposal; browser cancel; delayed file read superseded by reset                                                       |
| R5 import/export and preservation | Domain round trip; browser downloaded JSON matches seed, reimport; malformed/oversized imports and invalid input preserve graph/results                             |
| R6 usable editor                  | Add/delete/reconnect real graph; typeahead keyboard connections; incremental scalar typing; numeric-looking strings; cleared position drafts; mobile branch editing |
| Security / persistence            | HTML-like text produces no HTML element; forbidden keys; nonfinite values; 41 nodes / 81 edges / 101 fields; UTF-8 oversized source; corrupt/denied storage         |
| Accessibility / responsiveness    | Explicit labels; keyboard typeahead; no overflow at 390/320px; representative text enlarged 200% at 720px; reduced-motion run completes                             |

Unit tests live in `tests/unit`; browser tests in `tests/e2e`. `vitest.config.ts` explicitly excludes browser files. Browser tests run in isolated contexts against the real Vite server, with Playwright's clock controlling execution timers. They assert semantic outcomes rather than decorative screenshots alone. Native select typeahead (`s`, then Tab) is used for platform-independent keyboard selection; macOS native popup arrow-key behavior is not assumed.

## Screenshots

`tests/e2e/relay.spec.ts` captures `docs/screenshots/desktop.png` and `docs/screenshots/mobile.png` only after executing the synthetic order route and confirming real state. The screenshots show completed/visited/skipped states and a populated inspector. They are not visual regression baselines; visual review and assertions are complementary checks.

## Limits of this evidence

- Chromium is the automated browser target. Safari/Firefox and actual iOS/Android devices were not tested.
- The text-size test doubles computed font sizes of representative semantic elements in a narrow layout; it is not a claim of exhaustive browser/OS zoom and assistive-technology certification.
- No load/capacity benchmark, fuzz campaign or penetration test was performed. Security tests target specified threat cases.
- The production smoke used the local built bundle with its CSP. GitHub Pages URL, CI run and clean-clone reproduction must be verified after publication.
- Native screen-reader output and multi-tab collaboration are not claimed. Chromium mouse and emulated tablet touch dragging are tested; physical device behavior remains unverified. Numeric positions and labelled connections remain supported.
- Browser persistence is last-valid-draft, last-writer-wins. Incomplete graph edits, input payloads and trace history are deliberately not restored after reload.

Independent review added malformed array-enum regressions for transform operations and condition comparisons. Both are rejected at import instead of being coerced to strings. All 56 domain cases and 22 browser journeys passed after the correction.

## Refinement regression evidence

The initial browser repro moved the mouse by 100px horizontally and 55px vertically but observed a node delta of 0/0. `canvas.spec.ts` now covers pointer-following, live edge movement, no preview storage writes, persistence on release/reload, clicks, Escape, browser cancellation, captured movement outside the original node, scroll stability, keyboard movement, exact native library-drop placement, invalid drop values, run locking, phone list behavior and CDP tablet touch end/cancel. A second regression exposed canvas shrinking while scrolling; retaining the canvas extent fixes the unexpected coordinate jump. Existing execution/import/security journeys remain in the same suite.

Independent review also imported node IDs named `__proto__`, `constructor` and `toString`. Measured heights now use a Map; three browser regressions require finite SVG paths and zero console/page errors for these valid IDs. Resize before pointerup is fenced even if the browser has not delivered its queued resize event.

The independent populated production scan found low contrast in dimmed skipped-node status and trace step indices. Skipped state now uses a distinct opaque surface and explicit status, while essential node labels and details are larger. The follow-up production scan is recorded with release evidence.


## Reversible graph editing — September 2026

September 23 iteration: `npm run check` passed 59 unit cases; `npm run test:e2e` passed 25 Chromium journeys. New cases cover a real multi-move drag as one undo edit, grouped typing, reload, deleted edges, unchanged captured traces, redo invalidation, keyboard scope and late imports. The preexisting corrupt-storage test exposed a mount-save regression; skipping persistence until the workflow actually changes fixed it. Browser evidence is Chromium on this machine, not a physical-device or all-browser claim.
