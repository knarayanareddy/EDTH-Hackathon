# Hackathon research and prototype package — handoff

This package combines two existing, independent projects for review by another assistant or developer. Their source files are preserved separately and unmodified; this is a collection, not a merged application.

## Contents

- `projects/hackreview/` — earlier Next.js/React/TypeScript project, with PostgreSQL-backed idea triage, 13 idea pages and interactive prototypes.
- `projects/hack2ndrun/` — separate React/Vite/TypeScript decision brief, with challenge comparisons and interactive prototypes.
- `original_archives/` — exact copies of both original ZIPs as retrieved from Google Drive.
- `SHA256SUMS.txt` — checksums of the original archives.

No `node_modules`, build output, database contents, or challenge datasets are bundled. Read project manifests and source code before running untrusted code. No real Nexus credentials or real data are supplied. Challenge descriptions in the applications are interpretations, not an authoritative replacement for the full challenge briefs.

## Purpose of the review

The owner would like one improved, coherent version based on the two projects. Examine both first, decide which useful parts to keep or combine, explain the architecture and trade-offs, then implement or propose a unified version as requested by the owner. Do not assume a ranking, a target audience, a deployment destination or permission to modify Google Drive. Ask the owner if an important product decision is unclear.

The surrounding research task: help a mixed or undecided hackathon team compare the Intelic Nexus, Mantavia public-AIS, and Fourth Law/Odd Systems thermal challenges; also consider credible independent, larger-scope venture ideas with narrow weekend demonstrations. The user values thorough evidence, realistic scope, comparison with existing tools, and clear distinctions between real results and simulations.

## Review notes to verify independently

These are leads from an earlier source-code inspection, not a substitute for testing:

1. `hackreview` has PostgreSQL state routes and requires `DATABASE_URL`. `IdeaWorkspace.tsx` uses one shared debounce timer for status, note and score updates; changing one field quickly after another may cancel a pending save. No authentication was apparent in the inspected state routes; check before public deployment.
2. `hackreview` includes a thermal preview that can load a 640×512 uint16 binary in the browser. It has not been validated against the supplied challenge file. Its Nexus and maritime previews include simulations, not evidence of live integration or real-data results.
3. `hack2ndrun` contains a synthetic Mantavia preview with a greedy sequential routing illustration, and a thermal lab using synthetic 192×144 data. It is not a completed Mantavia or thermal submission. A synthetic Mantavia metric is labelled `Real drags caught`, which needs clearer wording.
4. `hack2ndrun` Ground Truth's toy rule engine identifies distinct sensor IDs as independent; that does not establish physical or statistical independence. Its scenario tests are software-behaviour examples, not real-world detection performance.
5. Both applications include subjective recommendations and some technical claims that require verification. The prior review flagged overstated FPGA claims, unvalidated incident-specific claims, and conflicting incident dates. The Danish court states 26 February 2022 for the Samus Swan incident; the pasted brief stated 28 February. Confirm with the challenge owner. The event is 13–15 November 2026, so the 7–16 September 2026 AIS evaluation window is not in the future relative to the event.
6. A full Mantavia entry must use public data and include explainable alerts, the requested incident/week/blind-day checks, and prioritisation of a single limited-endurance ISR asset. A full Nexus challenge entry must demo on the hosted stack. Thermal image quality is the main evaluation criterion; actual raw-to-8-bit video, required outputs and measured resource notes remain necessary.
7. Previous inspection did not establish a live Nexus integration, real AIS replay, validated thermal output, operational accuracy, or user interviews. Label simulations clearly and do not present imagined outcomes as measured results.

## Previous checks

- The second project passed `npm ci --ignore-scripts`, `npm run build`, and `npx tsc --noEmit` in the review environment. That is a build/type check, not a browser, functionality, security or performance test.
- The first project was statically inspected; it was not installed or run.
- These checks do not certify either application.

## Suggested first actions

Inventory both projects and identify overlapping features. Separate source-backed facts from opinions, simulations and untested hypotheses; verify important citations and challenge details with the owner. Decide how to preserve the raw thermal loader, distinguish the sequential planner from real-data validation, and make saving and deployment reliable and appropriately private. Avoid claiming that the single HTML build makes external APIs or data available offline.
