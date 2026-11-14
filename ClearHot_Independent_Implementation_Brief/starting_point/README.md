# ClearHot Local Comparison

An offline, experimental workbench for comparing your preferred Argos 2 against the other five submitted classical pipelines and the newer Claude pipeline. It uses your recording **on your Mac**. The recording is not part of this package.

## Start on your Mac

1. Unzip `ClearHot_Local_Comparison.zip`.
2. Open **`ClearHot_Local.html`** in a current Chrome, Edge or Firefox browser. Safari may also work, but was not tested here. No Node installation, server, account, database or internet connection is needed to use the app. You can disconnect from the internet while using it.
3. Try the built-in synthetic sample first. For a small, quick trial, enter 320 and 256 for width and height and click **Apply decoder & window**, then **Run all methods**.
4. For your recording, choose it using **Local uint16 file**. Your browser reads frames from the file in slices; the package has no upload endpoint. The self-contained HTML has a restrictive content security policy blocking network connections, external scripts and external images. Avoid browser extensions or modified versions you do not trust.
5. Set the *verified* dimensions, byte order, initial header bytes and right shift, plus a useful fixed display window, then click **Apply decoder & window**. The default hypothesis is 640×512, little-endian, no header, 14 low bits. If you don't know the format, use these only as hypotheses, not confirmed facts. Exact division into frames does not prove the format. Header bytes are skipped **once at the start**, not per frame. Other packing, row padding and per-frame headers are not supported.
6. Use **Suggest window from current frame** if the reference looks all black or white. Check it visually; the window stays fixed for comparisons. Verify a few frames visually against your trusted existing viewer. Counts are sensor counts/ADU, **not temperature**. By design the shared decoder supports 14 bits only: it shifts and then masks to the lowest 14 bits. Higher bits are discarded. Right shifts 0–2, little/big endian and configurable even dimensions are available. Verify any discarded bits against the file specification. Wider-bit pipelines and calibrated temperatures are not supported.

## Watch the full recording

1. Select the recording and apply the verified decoder settings above. If necessary, click **Suggest window from current frame**.
2. In **Video playback · local**, choose **Argos 2** (the initial selection), another method, or the fast raw fixed-window reference. Set your desired playback rate, then click **Play from current frame**. The player reads and displays all whole frames in order until the end; it does not deliberately skip frames. You can pause, seek using the slider, restart at frame 0, or show a selected processed still.
3. A demanding algorithm on a large frame may take longer than the target interval. The player will then run slower rather than discard frames. The file reader has no validated frame-rate metadata; set fps according to the recording specification. There is no audio. The viewer is not an exported MP4.
4. The player keeps algorithm temporal state during one uninterrupted play run. It resets state when paused/resumed, seeking, changing source or method, and when starting a new run. Claude B may read future frames and is explicitly offline. The separate blinded comparison still starts all algorithms from a fresh state on each sampled frame.
5. Playback names the methods, and you may recognize their output. Do the blind ratings first if avoiding that bias matters. Playback supports visual sequence review but does not automatically quantify flicker, ghosting, detection rates or ground truth.

## A practical evaluation

### Before reviewing

- Set aside a representative *development* section and a genuinely separate *held-out* sequence before tuning. Prefer independent recordings, capture conditions, motion and scenes. If using the same file, leave generous gaps, document the split and beware that adjacent frames are highly correlated. Original Claude B reads multiple frames and at the beginning may read future frames; keep its context completely outside the other split. Separate source files are safest. The app's development/held-out selector is a label and cannot verify independence.
- Record the file's local SHA-256 using the button if practical. This may take time but is done locally. Write down the sensor/file specification, capture conditions and intended split. Select a fixed reference window once and do not change it while judging a split.
- The app uses frozen default configurations rather than an automatic optimiser. You can change the decoder and reference window, not the individual method parameters. Freeze settings **before recording held-out observations**. To compare different source files, unlock, select the next file, restore exactly the same settings and freeze a new plan; the exported per-observation settings let you audit this.

### Collect observations

1. Choose the frame index and load the reference. Draw rectangular ROIs on the fixed-window raw image: animals, bridge, nearby backgrounds, thin structures, and relatively flat areas with stripes. They are shared across methods and shown as outlines. For a moving object, reposition its rectangle as needed. ROIs are not object segmentation and no ground-truth boundary is supplied.
2. Click **Freeze settings** when the source, decoder and window are set. This fixes the candidate settings too. A frame/ROI may still be changed as required for evaluation.
3. Click **Run all methods**. The same decoded current frame is delivered to each. Read the important tone-mapping limitation below. Blind candidate order is randomized in the tab. It's ordinary blinding, not a secure clinical-study system: a knowledgeable observer may recognize a method or inspect the export/source. Do not reveal names or open exported JSON/CSV while judging.
4. Score visibility, detail and artifact control (1 poor to 5 good); open **Per-ROI review** for each candidate to score individual ROI visibility, note feature loss and describe artifacts. Scores are subjective, not a measurement of detection accuracy. Record uncertain labels as uncertain. Record frame-level context and motion in the note.
5. Click **Record measurements & ratings**, then inspect another frame. To get a simple consecutive-frame change statistic, record a frame, move to its immediate next frame without changing ROI geometry and run/record again. The reported mean absolute display difference includes scene/camera motion and is **not** a standalone flicker or ghosting measure. Use a truly static background ROI, independent visual inspection and a sequence-aware evaluation before making temporal claims.
6. Sample frames including animals and bridge, thin lines, different backgrounds, difficult stripes, movement and static sections. Repeat review across several scenes. If possible use independent human reviewers and record their identities separately without putting sensitive information in shared files. Freeze before examining held-out examples.
7. Export **session JSON** and **measurements CSV** before closing the tab. They include method identities/blind mapping, source name, optional hash, frame indices, settings, ROI coordinates, scores, measurements and notes; they do **not** include thermal frames. Treat the exports as sensitive. Anyone with an export can unblind it.

The JSON restores records, settings, method order and currently drawn ROIs; it does **not** restore the recording. Reselect the same file. The app retains ROIs if file name and size match, which is not strong identity verification; re-run SHA-256 and compare it to the saved digest when one was recorded. If you select a different file, current ROIs are cleared after confirmation. Exports from different plans can be analysed together, but explicitly check the stored settings and file identity.

### What is compared

The 12 blind candidates are:

- Argos 1, **Argos 2**, Argos 3; original Claude A, B and C; newer Claude lab pipeline: **seven complete classical configurations**.
- Argos 2 with stage 1 bypassed (both line correction and bad-pixel work are disabled), and Argos 2 with stage 4 detail bypassed. These are partial-pipeline experiments, not pure isolated contributions; other stages remain active.
- New lab line-only, and two versions with default line correction and detail gains 1.5 and 3.5. The complete new-lab candidate uses gain 2.5. These are predefined controlled experiments, not validated optimal settings.

The original methods' default settings and classical code are used, with CNN disabled. Original Argos pipelines return their original 8-bit processed display, original Claude A/B/C return their original processed 8-bit output, and the new lab returns its 8-bit output. The **same raw fixed-window image is always the reference**. The original methods retain their native automatic tone mapping and display enhancement; the new lab uses the fixed window. Therefore the candidate images are **not all mapped through an identical fixed window**, and differences mix restoration, tone mapping and sharpening. This is a faithful native-output comparison against a consistent raw reference, not a perfectly isolated common-tone experiment. Do not interpret candidate brightness as temperature.

In the blinded still-frame comparison, every method starts with fresh temporal state for each run to make a frame reproducible. The separate playback panel keeps state across frames within one uninterrupted play run. Original Claude B still loads a neighbourhood of frames for its native multiframe line/noise steps and may look ahead. The still-frame comparison is offline and cannot establish live latency, sequential temporal performance, visual flicker, or ghosting. Playback permits visual temporal inspection but is not a validated temporal metric or a real-time guarantee. The timing shown is one in-browser end-to-end method call on your computer, not a stable benchmark or hardware throughput claim. Source frame reads, browser scheduling, warm-up and method-specific computations differ. The simple previous-frame change statistic is a motion-confounded proxy, not a real temporal validation. Full sequence-aware evaluation is still needed.

Raw ROI medians, MAD-derived robust spread, display medians and spread are descriptive. Animal–bridge median difference and pooled-spread ratio have **no universal 3× separability verdict**. The statistics may change with ROI placement, background, quantisation, saturation, texture and motion. A true physical temperature comparison requires sensor calibration, emissivity and reflected-radiation context. A brighter processed region is not proof of a hotter animal or of correct object identification.

## Safety, storage and migrations

This is a **replacement local evaluator**, not an in-place repair of the Next.js app or its database API. It contains no web server, database or records API. Database authentication and SQL migration are not applicable to this standalone tool. It does not update, secure or migrate any separate Next.js deployment you may have. Do not expose that original application's unprotected endpoints publicly without separately adding authentication, authorization, request limits and a migration.

Results live in the tab until manually exported. Closing it without exporting loses the observations. Session imports are intended for trusted files. Do not import someone else's untrusted JSON. Export files can reveal sensitive scene metadata even though no pixels are included. Keep them on your Mac unless you intentionally share them.

## Rebuild and automated checks (optional)

The HTML is ready to use. To rebuild from source on a Mac with a current Node.js (20+ recommended) and npm:

```sh
cd ClearHot_Local_Comparison
npm ci
npm run build
npm run typecheck
npm test
```

`npm ci` downloads **development software dependencies** from npm, not recordings. `package-lock.json` pins those dependencies. `npm run build` produces the single HTML and the Node test bundle. `npm test` runs ten synthetic/unit checks including both endian modes, 14-bit shifted decoding, a file header, reference mapping, ROI semantics, deterministic outputs for every candidate, bypass changes and confirmation of Claude B's look-ahead.

The three optional browser scripts under `tests/` additionally require the separately installed Playwright package and a compatible Chromium; they are not part of `npm test` or the lockfile. They were run during this review in the provided sandbox. They exercise synthetic ROI/blinding/export flows and a generated 640×512 two-frame file, hash, all candidates and network-request observation. They do not prove compatibility with your file, Mac/browser, database, or real-world fidelity.

## Provenance and modifications

- `src/argos/thermalPipelineEngine.ts`, `src/argos/cnnPrototypeEngine.ts` and `src/types/thermal.ts` come from the Argos archive. The engine and CNN file match the archive bytes. CNN remains disabled in all evaluator configurations; the CNN source is present because the original engine imports it.
- `src/claude/dsp.ts` is from the original Claude archive. `src/claude/pipeline.ts` differs only in its import path for CNN: it imports the local intentionally disabled stub rather than TensorFlow. This avoids shipping a model and preserves the classical processing path.
- `src/lab/` contains algorithm files from `clearhotclaude.zip`; this evaluator only uses the lab pipeline in 14-bit fixed-window mode. Its old 15–16-bit UI, overconfident ROI verdicts, stale ablation panel and database API are **not** used here. This is a deliberate restriction/replacement rather than a 16-bit fix in the original app.
- `src/core.ts` is the common decoder and method adapter, preset definitions and ROI calculations. `src/app.ts` is the new offline UI. All candidate settings are included in exported JSON.
- `ORIGINAL_REVIEW.md` documents prior independent probes and caveats. The original archives on Drive were not modified.

## CNN later, not now

No CNN training, model loading or feedback loop is implemented here. If a classical baseline is established, a separate opt-in experiment should use suitable paired clean/noisy or validated noise data; hold out recordings, devices and time periods at sequence level; examine hallucinations and feature loss; compare against the frozen classical baseline; retain human approval before use; and log dataset versions, labels, model, parameters and errors. Adjacent frames with correlated stripes or motion are not automatically valid Noise2Noise targets.

## What remains unverified

This package was tested with generated files and synthetic scenes in a sandbox, not on your recording or your Mac. It cannot verify the source format, sensor calibration, animal labels, hidden ground truth or real-scene detection performance. It does not provide a proven winner, synchronized multichannel playback, synchronized temporal warm-up, blind-review participant management, automatic object detection, full registration, objective flicker/ghosting measurements, per-pixel masks, calibrated temperatures, a validated CNN, or operational guarantees. Your next step is to try the recording locally and inspect representative held-out scenes; share only the exported metadata if you want help interpreting it and are comfortable sharing it.
