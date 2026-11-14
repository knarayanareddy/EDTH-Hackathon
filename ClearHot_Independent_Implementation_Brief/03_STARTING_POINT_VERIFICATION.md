# Verification of the supplied starting point

This records checks performed on the supplied v1.1.0 app, not claims about either agent's future implementation or the user's recording.

## Environment

Linux x86_64 sandbox; Node v20.20.2; npm 10.8.2; headless Chromium through an existing sandbox Playwright installation. This is not a test on the user's Mac. The 180 MB recording was not included or inspected.

## Fresh-copy check

In the packaged `starting_point/` directory:

```text
npm ci --no-audit --no-fund   PASS (development dependencies installed)
npm run build                 PASS
npm run typecheck             PASS
npm test                      PASS: 10 / 10 synthetic/unit tests
```

The rebuilt `ClearHot_Local.html` SHA-256 matched the delivered player: `3b301bc8ec28cdd0b56b7fc216fa1094c79c1e51db544e3d6b0790fd17f8fef4`.

The three optional Playwright scripts were run against this fresh copy, with the sandbox's existing Playwright dependency supplied via `NODE_PATH`:

- `tests/browser-check.cjs`: synthetic ROI drawing, 12 configurations, blind labels, candidate/per-ROI scoring, freeze, export, consecutive-frame proxy and reveal passed; no browser HTTP requests or page errors observed.
- `tests/file-browser-check.cjs`: generated 640×512 two-frame local file, local SHA-256, 12 methods, metadata export/import and matching-file ROI restoration passed; no browser HTTP requests or page errors observed.
- `tests/playback-browser-check.cjs`: generated five-frame local file, Argos 2 playback, no intentionally skipped frames, end, seek, current frame, restart, raw, pause and auto-window passed; no browser HTTP requests or page errors observed.

These are **limited synthetic smoke and unit tests**. The starting browser suite does not establish the new assignment's required >60-frame playback, actual CNN integration, user-Mac performance, temporal reliability under all races, or fidelity to a specified real sensor format. The future agent must add and run its own acceptance tests, reporting actual failures.

## Original archive identities

```text
fa73ac869c67abcb368a11dc9ad3d6fa6770d800e9b5634ec2761b3ffa8d8c68  reference_submissions/thermalimageargos.zip
1ccaf596d2091913b6c876dcac9328b184d425680ac8de6fcbb07fa06772e97a  reference_submissions/thermalimageclaude.zip
30b465afa1c7ad1099ec6006f73aa0edd3a7a0031ccbb79c63ad7dbcc34ab95b  reference_submissions/clearhotclaude.zip
d855a41277a2fc68503cb3cbba4654d8e07f39526b992d27f4f330a0c75cd666  reference_submissions/clearhotargon.zip
```

The main starting-point engine copies were inspected. `src/argos/thermalPipelineEngine.ts` and `cnnPrototypeEngine.ts` match their original archived files; `src/claude/dsp.ts` matches its original archived file, and the only diff in `src/claude/pipeline.ts` is replacing its CNN import with an intentionally disabled stub. The single-frame adapter supplies a shared 14-bit decoded input but does not magically make native AGC or context identical. The seven full classical configurations and five additional ablations are identified in `starting_point/src/core.ts` and `starting_point/README.md`.
