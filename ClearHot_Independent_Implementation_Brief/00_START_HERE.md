# ClearHot: identical implementation assignment for both agents

**This is an implementation assignment, not a request for a proposal or another audit.** Claude and Argon receive this same package and the same instructions. Work independently and deliver your own complete runnable solution. Do not assume the other agent will build a missing part.

## Read these files first

1. `01_IMPLEMENTATION_REQUIREMENTS.md` — the binding task, acceptance criteria and deliverables.
2. `starting_point/README.md` — how the current app works and its limitations.
3. `independent_reviews/ClearHot_Six_Method_Independent_Review.md` — original methods and independent tests.
4. `independent_reviews/ClearHot_Claude_Submission_Independent_Review.md` and `independent_reviews/ClearHot_Argon_Submission_Independent_Review.md` — concrete failures to avoid.
5. Inspect the actual source and tests in `starting_point/`. The old `independent_reviews/ClearHot_Independent_Evaluation_and_Agent_Brief.md` is useful background, but where it suggests merely *proposing* a feedback loop, this assignment takes precedence: **implement a working opt-in controlled offline loop**.

## What is in the package

- `starting_point/` — the **current working local comparison and video player, v1.1.0**: complete source, ready-to-open `ClearHot_Local.html`, lockfile, tests and instructions. This is your required starting point, not either later Next.js app. The HTML opens locally and reads a recording in the user's browser; the source implements a common 14-bit decoder, original classical adapters, a shared reference, 12 configurations, ROI review, exports and single-method sequential playback.
- `reference_submissions/thermalimageargos.zip` and `thermalimageclaude.zip` — original source archives containing Argos 1–3 and Claude A–C. Consult these to preserve the exact methods and defaults. They are references, not permission to silently replace the working app.
- `reference_submissions/clearhotclaude.zip` and `clearhotargon.zip` — later submissions, included **for review/reference only**. Both contain useful ideas and important documented problems; neither is the new authoritative starting point.
- `independent_reviews/` — independent findings, including deliberately reproduced failures. Do not treat later agents' reports or seeded data as ground truth.
- `SHA256SUMS.txt` — checksums for supplied files. The ZIP and its internal starting-point HTML are not the user's actual recording.

## User context and non-negotiable constraints

- The user has an approximately 180 MB thermal recording on their Mac and says Argos 2 looked best in a prior visual comparison. **No agent or reviewer has seen that recording here.** It is **not included**; do not claim results on it or try to download it. The user wants it to remain local.
- Argos 2 is a user's preferred practical reference, **not a proven winner**. Keep the actual original Argos 2 available, with original classical code and defaults. Preserve an easily reachable raw/fixed-window view.
- 640×512, headerless uint16, little-endian, low 14 bits is an **unconfirmed hypothesis**, not sensor documentation. No calibrated radiance or temperatures can be inferred from these inputs. The existing app intentionally supports 14-bit data only because the original algorithms are 14-bit.
- The user wants a working system, not just screenshots, synthetic seeded reports, an architecture diagram, a prompt or a trainer that cannot be used with the player. Include actual source, dependencies/setup, tests and commands.
- The user wants a **controlled offline learning loop with human review, frozen comparisons, safety checks and rollback**. Do not perform silent online self-training or automatic deployment. The loop may be rerun as new vetted data arrives; do not promise each cycle will improve all scenes.
- The application, measurements, extracted frames, labels, model weights and reports should stay on the Mac. No upload, cloud account, externally hosted inference, analytics or remote database by default. Dependency downloads during installation are acceptable only when explicitly disclosed; normal use is offline. Do not request the user to share sensitive footage or credentials.

## Quick verification of starting point

Open `starting_point/ClearHot_Local.html` locally in a recent Chrome/Edge/Firefox browser. To rebuild/test from source with Node 20+ and npm:

```sh
cd starting_point
npm ci
npm run build
npm run typecheck
npm test
```

`npm ci` downloads development packages. The existing optional browser tests additionally require Playwright and Chromium, which are not in the starting lockfile. No recording is needed for the shipped synthetic tests. The original static HTML is ready to open without installing anything. Do not mistake successful toy tests for real-file validation.

## Keep the handoff honest

The starting app is a useful **experimental baseline**, not a validated 25 fps, 16-bit, temperature, full temporal-analysis or CNN product. Its comparisons use the same current decoded frame but original methods retain different native AGC/tone and temporal behaviours; Claude B can read ahead. The prior versions of Claude/Argon each had the issues identified in the reviews. The user wants these limitations addressed or explicitly exposed—not hidden under a reassuring label.

Read the detailed assignment before implementation. Produce the requested deliverables as a ZIP including your updated source and a short machine- and human-readable test report. Tell the user what passed, what did not, and what is still impossible to assess without their local data.
