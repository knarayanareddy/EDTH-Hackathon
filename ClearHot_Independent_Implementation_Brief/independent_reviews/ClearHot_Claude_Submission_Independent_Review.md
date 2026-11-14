# Independent review: clearhotclaude.zip

## Bottom line

This is a useful, candid **new experimental thermal-image lab**, not an updated six-method comparison. It supplies a fixed-window reference, manual ROI measurements, line correction, detail enhancement, optional CLAHE and causal temporal filtering, plus a synthetic benchmark. Its own audit correctly says the original Argos 1–3 and Claude A–C were not ported or rerun, and that there is no CNN or real-data validation. It therefore cannot independently establish whether your preferred Argos instance 2 is best, or whether this new pipeline improves it.

**Do not treat the generated animal-versus-bridge verdict as definitive, deploy the measurement API publicly, or use the advertised 15–16-bit decoding as a fully supported pipeline without fixes.** See below.

## Scope and checks

- Downloaded and safely extracted the Drive ZIP; the original Drive file was not changed. The submitted archive contained 41 entries and about 141 KB uncompressed. It did not include the six original implementations, a README, a lockfile, bundled automated tests, or a SQL migration.
- Installed dependencies locally. TypeScript check, production build and lint passed. Build required a dummy `DATABASE_URL`. These checks are not proof that database persistence works.
- Headless Chromium: synthetic viewer rendered two canvases, loading truth ROIs produced three animal, one bridge and one background ROI; stage ablation produced six canvases; synthetic benchmark completed; an independently generated two-frame 640×512 uint16 file loaded and stepped to frame 1. No page errors were observed. No POST requests occurred during these interactions because Save was not clicked.
- Independently compared the project's SHA-256 implementation against Node crypto at lengths 0, 1, 55, 56, 64, 65 and 100,000 bytes: all matched. Tested one global tone curve for monotonicity: passed. These are limited checks, not a comprehensive test suite.
- Ran the included benchmark at 320×256 with two development seeds and two held-out seeds; its results and limitations are discussed below. A small targeted 16-bit test confirmed a defect described below.
- **Not tested:** your approximately 180 MB recording, real sensor format, optical/temperature calibration, real scenes or field labels, database insert/list/delete with a real PostgreSQL instance, concurrent user behaviour, public deployment security, target computer throughput, real-time performance, CNNs, or FPGA implementation. No conclusion here should be read as a real-file comparison.

## What the project implements

1. Browser-side file slicing and decoding of headerless uint16 frames, with editable dimensions, initial file header, byte order, shift and bit mask. Format hints are explicitly non-conclusive.
2. Side-by-side raw fixed-window and processed views, difference display, manual animal/bridge/background ROIs, and raw, line-corrected and display-domain statistics.
3. Column/row profile line correction, guided base/detail enhancement, fixed or percentile global tone mapping, optional CLAHE, and optional causal temporal smoothing. Reset logic handles source, decoder, correction or temporal changes and nonconsecutive frame changes in the code. I have not exhaustively stress-tested seeking or playback.
4. Stage ablation, latency panel, session export, optional metadata/measurement storage in PostgreSQL, and a synthetic generator and benchmark.
5. An audit page that is unusually explicit about the missing original implementations, synthetic-only evidence and the absence of a CNN.

## Issues to fix before trusting results

### 1. Above-14-bit files: accepted by decoder but processed incorrectly — confirmed

The decoder allows 8–16 bits, but frame histograms, percentile tone mapping, automatic windows, fixed-window controls and the monotonicity report hard-code a 14-bit range (0–16383). A targeted input with values `[20000, 30000, 20000, 30000]` decoded correctly at 16 bits, but `frameStats` returned p1/p50/p99 = **16383/16383/16383**, and the percentile window became **16383–16384**. Auto-windowing and controls can therefore clip or misrepresent these files. Even for 14-bit sources, the actual file layout and shift must be confirmed, not inferred from a plausible image.

**Fix:** carry the active code range consistently through all histogram, window, UI and report logic; test 8, 14, 15 and 16 bits, both endian modes and shifts. Alternatively restrict the UI honestly to 14 bits until it is fixed. Then verify against the actual sensor/file specification.

### 2. ROI pair verdict overstates what a threshold can prove

The app labels raw ROI medians as “NOT separable” when their difference divided by pooled robust spread is less than 3, and asserts that enhancement cannot recover a trustworthy difference. The 3× cutoff is a heuristic, not a demonstrated universal boundary. It does not establish whether an animal and bridge are distinguishable using spatial context, distributions, multiple frames, denoising or other evidence, nor whether they differ in actual temperature. A tested synthetic ROI pair with a 20-ADU median gap and ratio 1.35 produced the categorical verdict despite a 10-level reference-display difference.

Conversely, a ratio ≥3 is not proof of class separation or calibrated temperature. Ratios depend heavily on ROI size, object/background mixing, texture, spatial correlations and placement; the bridge and animal may have different local backgrounds. The “fixed-window display preserves the ordering” message describes the reference view, not necessarily the processed image.

**Fix:** report the actual deltas, spreads, clipping and pixel distributions, label the threshold as exploratory, add paired local-background comparisons and uncertainty, and avoid universal conclusions. Validate with repeated/blinded annotations. Local enhancement can improve visibility but cannot create evidence of physical temperature where calibration and scene context are absent.

### 3. Ablation results can become stale without warning

`AblationPanel` identifies a result as stale only when source/decoder/frame key changes. The displayed ablation also depends on pipeline settings and ROI definitions, but changing those does not update the stale key. A user can therefore see old results without a warning after editing settings or ROIs.

**Fix:** snapshot and display full configuration, source/frame and ROI definitions with each run; invalidate or visibly mark results stale whenever any input changes. Test this in the browser.

### 4. Persistence is not inherently local or access-controlled

The UI reads frame pixels in the browser; the reviewed Save action sends metadata, file name/size, optional hash, ROI coordinates, settings, notes and numerical results to `/api/records` rather than explicitly sending pixel arrays. However, the server and configured PostgreSQL database may be remote, so “local DB” is not guaranteed by the code. The records GET/POST/DELETE routes do not implement authentication or authorization, and the JSON fields are permissive. Do not expose them publicly or store sensitive information until access control, input limits and deployment architecture are addressed.

A dummy DB URL allowed a production build but **did not test persistence**. A usable deployment needs a real configured database and creation of the `measurement_records` schema; the archive includes a Drizzle schema but no migration SQL. For the running review preview, saving and Records should be considered unavailable.

### 5. Provenance and asynchronous state need further hardening

File/frame reads have an effect cleanup guard against late frame reads, which is good. But settings are deferred, and selected source/frame/config metadata are maintained separately from the last processed view. Hash and format-diagnostic operations are also asynchronous. Rapid changes while saving, exporting, hashing or switching sources deserve targeted race tests so that file hash, frame, config and pixels cannot be mis-associated. Source identity is based on file name, size and last-modified time, not content hash. This is a code-review risk, not a reproduced failure in this review.

### 6. Feature-preservation and runtime claims remain provisional

Line-profile correction can mistake genuine scene structure for fixed-pattern stripes, as the UI itself warns. The single synthetic thin-retention number averages various structures and can conceal loss of a particular true full-height line; values above 1 indicate boosted contrast, not necessarily better fidelity. Use per-object/edge masks, multiple scene geometries, shift and motion tests and blinded inspection. Main processing and the synthetic benchmark run on the browser thread; processing may affect responsiveness, and no target-Mac speed or 25-fps result was established.

## Independent synthetic benchmark spot check

The app compares four **new** frozen configurations: raw identity, line correction, detail only, and line + detail. Development seeds were 1–2; held-out seeds 1001–1002. Both splits use the same generator, layouts and noise model. The following are two-seed means from the submitted benchmark at 320×256, not evaluations of your recording:

| Scenario | Variant | PSNR dB | Stripe residual RMS ADU | Aggregate thin contrast ratio |
|---|---|---:|---:|---:|
| Strong column stripes | Raw | 46.18 | 75.43 | 1.027 |
| Strong column stripes | Line | 59.62 | 6.52 | 0.998 |
| Strong column stripes | Line + detail | 54.91 | 6.68 | 1.504 |
| Stripes + true full-height line | Raw | 51.97 | 37.71 | 1.015 |
| Stripes + true full-height line | Line | 60.59 | 3.68 | 0.870 |
| Stripes + true full-height line | Line + detail | 54.93 | 3.83 | 1.345 |

These results show the specific implementation can reduce this generator's injected stripe residual; they also show that detail gain changes contrast and PSNR and that correction can suppress aggregate thin contrast. They do **not** prove the new pipeline is superior on real data or to Argos 2. The reported stripe residual uses the known synthetic clean image, which is unavailable for real captures. The metric called thin retention combines all masked structures, not an isolated measurement of the true full-height line.

## Recommended next steps

1. Preserve Argos 2 as the practical reference, based on your visual preference—not as a proven winner. Bring all six original algorithms and this new pipeline into one reproducible comparison using the exact same locally loaded frames, decoder, ROI definitions and fixed reference window.
2. Fix 14-bit assumptions, provisional ROI verdicts, ablation provenance and database security first. Provide automated tests, a lockfile and migration/setup instructions.
3. On your recording, select representative frames and moving sequences; include animal, bridge, background, thin lines and difficult stripes. Save frame indices and ROI coordinates, inspect reference and processed displays blinded, and quantify per-object visibility, feature loss, artifacts, flicker and timing. Describe raw data as sensor counts until calibration is verified.
4. Compare Argos 2, its individual stages, the new pipeline and controlled detail-enhancement variants. Freeze settings before a held-out real sequence and document tuning separately. A simple visual improvement on one scene is not sufficient evidence of general performance.
5. Only after a classical baseline is established, consider a CNN as a separate opt-in experiment with appropriately paired or validated noise data, sequence/device-level splits, artifact checks and a human-review loop. This submission contains no CNN and does not test such a feedback loop.

## Preview

A temporary server was started for inspection. It uses a dummy database connection; view and synthetic analysis can be explored but measurement saving/Records are not set up. If you load your file into a remotely hosted preview, the reviewed viewer code reads frame pixels client-side, but note that any saved metadata would go to the preview server if its API/database were configured. For sensitive files, use a trusted local setup and review the deployment.
