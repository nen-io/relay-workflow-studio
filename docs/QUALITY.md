# Engineering and release contract

## Scope and autonomy
Implement the accompanying SPEC.md completely in this project directory. The user authorized implementation and review of all eight projects. Produce a written visual layout plan in docs/DESIGN.md before UI implementation; internal design review and refinement are authorized. Do not pause for an additional design approval. Keep each repo independent. Do not read/copy private source or application data. Parent owns publishing, independent review and cleanup; implementers must not push or delete projects.

## Stack and code
React + TypeScript + Vite, browser-first static demo, npm lockfile, Node24. Domain logic in focused modules independent from React where useful. Avoid giant minified one-file apps, arbitrary eval, unsafe HTML and silent swallowed failures. Explicit input validation and immutable state transitions. Comment decisions/invariants, not every line. Use current official library docs; record consulted sources in docs/ARCHITECTURE.md. Pin installed dependencies with lockfile. Relative Vite base for GitHub Pages. No tracking, external fonts, API credentials or network-only assets. Lucide icons optional; do not use emoji as UI icon placeholders.

## Design
Write docs/DESIGN.md first: layout, typography/colors, primary journey, invalid/loading/empty states, phone layout and reduced motion. Build a distinctive polished app with hierarchy, considered spacing and useful density. Controls must do what labels promise. Do not pad screens with fabricated metrics. Support320px and1440px,200%text zoom, keyboard navigation, visible focus and accessible names; honor reduced motion. Every input labelled. DOM text rendering for user content. Persisted state validated/versioned; localStorage denial/corruption nonfatal. CSS scoped/organized, components split at meaningful boundaries.

## Tests and acceptance
Use Vitest for domain invariants and real integration tests. Use Playwright test files (explicitly requested by user) for full primary journeys, invalid input, screenshot and phone smoke checks. Assertions must verify outcomes, not merely clicks or implementation details. Tests deterministic with controlled time/seed; no permanent skip/fixme or asserting true. Include npm scripts dev,build,typecheck,test,test:e2e,check (typecheck+unit+build). Use local Playwright Chromium; test artifacts ignored. Parent will independently exercise/review each app and fix defects. Do not claim passing checks you did not execute.

## Required files
README.md: compelling overview, screenshot path, demo URL placeholder clearly marked until parent sets verified URL, quickstart, exact scripts, features/limits, demo walkthrough.
SPEC.md (preserve requirements; document decisions without silently removing tests).
docs/DESIGN.md; docs/ARCHITECTURE.md (model/modules/tradeoffs); docs/TESTING.md (test map/commands/results/limitations); docs/ASSETS.md (original or license provenance).
MIT LICENSE, .gitignore, .nvmrc, package-lock.json. Appropriate example input/export fixtures. Parent will add/validate GitHub CI/Pages publishing workflow. No fake badges or invented metrics.

## Handoff
Run npm run check and npm run test:e2e; record results and exact known limitations. Tell parent paths, domain exports and dev port. Add screenshot to docs/screenshot.png only if actually captured from running app. Do not commit until parent requests; no shared files outside project ownership.


## Security, scalability and engineering explanations (user requirement)
Required docs/SECURITY.md: assets/trust boundaries, attacker capabilities, threat table, concrete mitigations and matching tests, residual risks, responsible reporting instructions without inventing contact address. State why static no-account demos avoid some server threats but still need untrusted file/storage/URL validation, XSS-safe rendering and bounded resource use. Local backend must validate HTTP inputs, bind loopback, reject unexpected origins where relevant and explain missing production auth/TLS/rate limiting. No claims of perfect security or production hardening without evidence.
Required docs/SCALABILITY.md: real implemented limits and rationale, algorithm/time-space costs, measured performance only if actually benchmarked (document hardware/input/procedure), bottlenecks, overload behavior, and staged design for10x/100x scale. Discuss consistency, persistence, caching/queues/worker isolation only as relevant. Clearly separate implemented behavior from proposed production changes. No invented throughput or blanket claims.
Required docs/DECISIONS.md: at least4 substantial ADRs (context, alternatives, chosen approach, consequences and revisit trigger) explaining framework/domain boundary, storage/execution, security scope and scaling tradeoff. docs/ARCHITECTURE.md must walk through a concrete user action from UI through domain/state/storage and back, with a Mermaid diagram and module map.
Tests include adversarial malformed/oversized input, HTML-like strings rendered safely, corrupt persistence if present, relevant cancellation/race/idempotency boundaries and resource limits. Document browser security policy and dependencies accurately; do not call npm audit alone a security audit.
Capture actual running app desktop and mobile screenshots to docs/screenshots/desktop.png and mobile.png; include README desktop image and link mobile. Screenshots must show representative populated states, not loading/error pages. docs/TESTING.md records commands, actual checks, and known limitations. Implementation includes no analytics or secret-bearing fixtures. Imported content never goes to third-party servers.
