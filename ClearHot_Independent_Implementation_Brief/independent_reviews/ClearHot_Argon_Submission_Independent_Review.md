# Independent review: `clearhotargon.zip`

## Bottom line

Argon's submission is an ambitious experimental **Next.js workbench** with a unified processing engine, synthetic benchmark, ROI measurements, stage ablation, an A/B review interface, four new classical candidate pipelines and a proposed CNN feedback plan. It also embeds an unchanged copy of the earlier six-method workbench.

**I would not rely on its rankings, claimed improvements, saved A/B evidence, or claim that its new unified “original” outputs are unchanged.** Important findings include seeded example votes presented as blinded trials; an allegedly saved vote shown as recorded despite a server error; performance claims not reproduced by the bundled benchmark under its default settings; an inactive Argos 2 “detail-only” ablation; and a sampled fingerprint presented as a file SHA-256. It is a promising source of ideas, not yet a trustworthy evaluation or an iteratively self-improving system.

No actual recording was inspected, no real-ground-truth thermal measurement was evaluated and no production deployment is endorsed. The Drive original was not modified.

## What I checked

- Downloaded the 2,721,634-byte ZIP and checked integrity and extraction paths. It contained 43 entries, ~2.7 MB uncompressed. The included six-method HTML is byte-identical to our previous workbench (SHA-256 `67be236e9a8f4c4d6dbaa927cd197039ebcc8192ecf9ca17baf533f448ea3740`). The ZIP's SHA-256 is `d855a41277a2fc68503cb3cbba4654d8e07f39526b992d27f4f330a0c75cd666`.
- Installed dependencies locally; TypeScript check and production build passed with a dummy database URL. Lint failed with two React effect errors in `src/app/page.tsx`. The submitted archive had no package lock, automated test suite or SQL migration. Its README and SHA256SUMS are copied from the earlier handoff and describe/list files not present at the expected paths in this new ZIP; they are not adequate setup/provenance instructions for this app.
- Launched the production app with a dummy URL and tested it in headless Chromium on its synthetic default. Two canvases rendered. The database request returned HTTP 500, as expected without a real database; the browser also reported one React hydration error. I did not test persistence with a real PostgreSQL server.
- Ran the bundled synthetic benchmark at its default 320×256, 12 methods and frames 25, 27, 29, and ran separate probes for original-versus-unified output, ROI ablation, 16-bit decode, fingerprint collisions and monotonicity checks.

## Self-improvement: proposed, not implemented

The panel `CnnHonestyAndAuditPanel.tsx` describes an **offline feedback loop as a proposal**: curate independent recordings, build trustworthy training targets, validate candidate models on held-out data and keep a rollback/fallback. There is no implemented training pipeline in this app that learns from user reviews or iteratively improves model weights. The database A/B reviews are not used to train a model.

Despite the Stage 1.5 “CNN” name, `runHonestCnnResidualStage` applies fixed hand-written directional filter coefficients with a gate. It does not load a trained TensorFlow model or do learned CNN inference, and no new model is trained in this package. The original embedded six-method handoff can contain its original experimental manual synthetic training facilities, but that is separate from an automatic real-data improvement loop and is not evidence that this new unified workbench learns.

## High-priority findings

### 1. Example A/B votes are pre-inserted as if they were review trials

`src/app/api/evaluation/route.ts` seeds four predetermined A/B records, complete with outcomes, reviewer IDs `blind-eval-panel-1` / `blind-eval-panel-2`, and written assessments. The A/B UI aggregates persisted records as **“Total Blinded Trials”**, wins/losses and Wilson confidence intervals without a demo/synthetic-vote flag or exclusion. The ZIP contains no evidence that these records are actual independent human judgments. Consequently, a fresh working database can show apparent evidence in favour of specific candidates before any user performs a review.

The initial “blinded” pair is also hard-coded as Argos 2 on the left and Exp-1 on the right; it is randomized only after the user chooses a new pair. The leaderboard aggregates criteria, scenes, reviewer identities and varying opponents, so its simple Wilson intervals are not reliable evidence of a general ranking even for genuine votes.

**Fix:** remove seeded votes from real results; if examples are retained, label and segregate them, exclude them from analysis, randomize the first pair, freeze identity/config/scene context, and analyse reviewer/scene dependence and criteria explicitly.

### 2. UI can falsely say a vote was recorded — reproduced

With a deliberately nonfunctional database, I clicked a synthetic A/B vote. The API returned **HTTP 500**, yet the UI displayed **“Vote recorded!”** and revealed the pair. The POST helper does not check `response.ok`; the same pattern occurs in other save handlers. Nothing was saved in this test.

**Fix:** treat non-2xx responses as failures, display an actionable error, do not claim a save or reveal as persisted until confirmed, and test success/failure/retry with a real configured database. Avoid resubmission duplicates.

### 3. Important numerical claims were not reproduced by the bundled default benchmark

The submission's report claims Exp-1 reduces the ±150 ADU stripe probe to **<5.2 ADU**, retains **>84%** of a one-pixel structure, and that original Argos 2 collapses the relevant synthetic animal–bridge display difference below roughly 1.2 levels. Running the **included** benchmark with its default config and held-out frame list `[25, 27, 29]` at 320×256 gave:

| Method in the submitted unified engine | Strong-stripe residual, ADU | Aggregate thin-wire contrast retention | Animal–bridge display median difference |
|---|---:|---:|---:|
| `argos_2` | 150.31 | 48.94% | 13.17 levels |
| `claude_a` | 24.19 | 32.51% | 20.00 levels |
| `exp1_argos2_radiometric` | 72.08 | 42.54% | 12.00 levels |
| `exp2_global_monotonic_locked` | 72.34 | 41.04% | 11.00 levels |

These are the bundled harness's metrics on its own synthetic data: strong-stripe residual is from the first held-out probe frame, thin retention is averaged over three hard-negative frames, and the display difference is averaged over three bridge/animal frames. A different unreported configuration or metric could produce different numbers; the report does not provide enough matching provenance to reconcile them. The figures above are not proof of real-world performance or a verdict on the original implementations. The thin-wire metric itself is aggregated over the synthetic mask rather than guaranteed preservation of every cable.

The seeded database verdict text nevertheless asserts specific impressive results regardless of what the benchmark computes. One seeded ablation additionally hard-codes raw and post-line deltas (138 and 136.5 ADU) rather than calculating both from the current frame, and adds a categorical pre-written explanation. The example UI on my run showed a different raw median difference (78 ADU) on the default frame. Keep seed/demo narrative separate from measured results.

### 4. The six “original” methods in the new engine are not established as unchanged

The unified workbench contains a rewritten `unifiedEngine.ts`, not the original six source pipelines. It applies a shared configuration and has structurally different temporal/context and tone logic. For example, the new unified Claude B uses at most three past frames and at most four future frames supplied by its UI, rather than the original default 12-frame context. The unified Argos 2 uses the shared settings (default strengths 0.85/0.7 and guided epsilon 1800), whereas the original Argos 2 defaults differ, and the new engine recomputes windows rather than preserving the original AGC history in the same way.

I tested an identical synthetic 320×256 current frame and partially aligned Argos 2 strength/detail parameters. The new `argos_2` display differed from the actual original Argos 2 on **81.1% of pixels**, with mean absolute difference **4.01** display levels and maximum **21**. Unified Claude A/B/C also differed in this spot check, but their settings and temporal context were not completely aligned. These are not equivalence tests, and differences do not prove which image is better; they do refute any assumption that the displayed defaults are interchangeable. A claim of a faithful port needs stage-by-stage equivalence tests under identical complete configurations and histories.

The bundled old standalone workbench is a separate, identical copy of the prior actual-six-method preview; it does not fix fidelity in the new unified engine.

### 5. Argos 2 “detail-only” ablation does not apply its detail stage — reproduced

For Argos 2 with line correction and tone mapping off, switching the detail toggle on versus off produced **zero pixel difference** on the tested synthetic frame. In `executeThermalPipeline`, the bypassed-tone branch runs before the Argos 2 fused detail branch, and Argos 2 is also treated as already having fused detail later. Thus the labelled detail-only result is not a valid isolated test of Argos 2 detail. The “raw fixed-window” ablation is also not necessarily using a user-locked fixed window when the global config is in automatic mode; it falls back to frame extrema in the relevant branch.

**Fix:** explicitly separate actual algorithm stages and prove each isolated path applies the intended operation; freeze the same explicit window for all ablation images and record the full config and context.

### 6. File identity and decoder claims are misleading

- For files above 24 MiB, `computeStreamingFileDigest` hashes only three 4 MiB samples, truncates the digest and appends a size marker. It is stored in a field named `fileSha256`; it is **not a full-file SHA-256**. I constructed two different 25 MiB files that had the same reported sampled fingerprint while their full SHA-256 hashes differed.
- The `full_16bit` decoder mode right-shifts all words by two, reducing them to 14-bit values. Independent test: `[20000, 30000, 40000, 60000]` became `[5000, 7500, 10000, 15000]`. This is not full-resolution 16-bit processing. High-14 mode and full-16 mode are effectively the same shift for uint16 input.
- A file smaller than one frame is reported as having at least one frame (`Math.max(1, ...)`) and is partly zero-filled by the decoder, rather than being rejected. Sampled endian diagnostics always collect high-bit statistics from little-endian words even when big-endian is selected.
- The “4.2 MB peak memory” and similar persisted values are hard-coded estimates, not measured end-to-end peak heap. Processing, caching, diagnostics and UI state allocate additional arrays.

**Fix:** use a real incremental full-file SHA-256 or clearly label a sampled fingerprint; reject short/incomplete frames; correctly support 16 bits end to end or remove that option; measure memory if reporting peak use. File size or a plausible-looking image does not prove the format.

### 7. No continuous video player in the new workbench

The new UI offers a frame slider and a `+1` control; I found no continuous playback loop. The slider allows access across a local file's declared frames, but `+1` uses `(frameIndex + 1) % 60` even for a file longer than 60 frames. It therefore jumps back to zero from frame 59 instead of continuing through the recording. Asynchronous frame reads retain the previous slice until the new one arrives, so a changed frame label may temporarily be associated with older pixels; saving during this transition needs a targeted race test.

The separate embedded older workbench is not the new unified viewer. For local continuous playback, use the separately delivered `ClearHot_Local_Playback.html` as an experimental viewer; it has also not been tested on your actual file.

### 8. Privacy and deployment security

The UI reads thermal frames locally with `File.slice()`. But optional ROI logs, source/file identifiers, coordinates, settings and reviewer notes are sent to `/api/evaluation`; those can reach a remote server/database if the app is hosted remotely. “Zero remote upload” should not be interpreted as meaning no data ever leave the browser after saving.

The evaluation API includes unauthenticated GET and POST operations, accepts user-provided benchmark dimensions/config, and has no apparent authorization or robust request/compute limits. Public deployment risks unauthorized reading/inserting of metadata and expensive requests. A dummy `DATABASE_URL` makes the build possible but does not validate storage. The app has Drizzle schema definitions, but no migration, lockfile or correct application-specific setup guide was submitted. Do not expose this API or use it for sensitive data until secured and tested.

## Other scientific issues

- The ROI diagnosis applies arbitrary 1.5σ / 2.5σ thresholds and attributes overlap to physical conditions or highlight compression. These are hypotheses/heuristics, not established causal diagnoses of a real animal, bridge, thermal radiation or temperature. A low median/spread ratio does not rule out useful spatial or temporal information.
- The monotonicity checker samples pixels, so a passing result is not a proof of full-frame monotonicity for an arbitrary spatial method. It also flags a synthetic example with equal input values and differing output as an inversion, despite its comment specifying strictly different input values.
- The default benchmark labels `[25..29]` as a contiguous holdout but evaluates **25, 27 and 29**. The benchmark provides at most two past synthetic frames and no future frames; it is not a real-time replay of the original 12-frame Claude B or a sequence-level out-of-device validation. “Fraction of timed synthetic calls above 40 ms” is not observed video frame-drop rate. Configuration hash is a short non-cryptographic fingerprint, not evidence that holdout was protected or a model is reproducible.
- The four new classical candidates are plausible experiments worth testing, including a fixed monotone reference and gated detail processing. Their names and physics cautions are useful, but a globally monotonic tone map preserves ordering only relative to the plane it maps—not necessarily raw sensor ordering after spatial correction—and quantization/clipping can collapse differences. Strong claims such as “prevents ghosting,” “no halos,” or “eliminates flicker” require independent motion, artifact and sequence testing.

## Recommended next actions

1. Remove/segregate hard-coded example votes and ablation numbers; eliminate misleading success messages. Add database authentication, resource limits, migration/setup and a lockfile, or use an offline-only architecture with no API.
2. Establish fidelity by importing the original engines directly or demonstrating per-stage and sequence equivalence under identical settings, context and decoder. Label reimplementations as such.
3. Correct decoder options and full-file hashing; reject incomplete frames and test source/frame races. Add true continuous playback and correct file-length stepping.
4. Repair stage isolation, lock a common reference window explicitly, pre-register held-out sequences/settings, and regenerate every claim from an auditable run manifest with exact data, code, metrics and parameters. Use multiple independent scenes/recordings, not only closely related generated frames.
5. Retest the new classical candidates on synthetic hard negatives and then on representative real scenes locally, with manual/blinded review and calibrated interpretation where available. Preserve Argos 2 as the user's subjective reference, not a proven winner.
6. If desired, build the feedback loop as a separate opt-in, human-approved research workflow: locally version data and labels, train only on defensible targets, isolate validation by recording/device/environment, compare with the fixed classical baseline, detect regressions and preserve rollback. Do not deploy an auto-updating model from unlabeled scores.
