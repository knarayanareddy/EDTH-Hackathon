# Prompt: review and improve the actual ClearHot module

You are an image-processing/thermal-imaging engineer and careful software reviewer. Inspect and run the attached code rather than assuming it works from its name. Ask targeted questions only when needed, state assumptions, and provide specific, reproducible evidence. Be imaginative but technically honest: this is an exploration, not a validated operational system.

## User's request and context

The user has a Mac and an organizer-provided thermal challenge video. In the earlier Idea Studio 2 preview they loaded it and observed that the processed output looked noticeably better than the input rendering. They now want to explore:

1. Reducing visible **parallel lines / static** in the video a bit while preserving detail.
2. Improving digital-picture quality: useful contrast and detail, with controlled noise, clipping, flicker, halos and ghosting.
3. Whether a **convolutional neural network** could be trained and tested for this problem, and if practical, an appropriately scoped training prototype and deployment path.

The challenge context provided so far describes 640 × 512 post-NUC, 14-bit thermal input stored in 16-bit little-endian raw words; output is 8-bit white-hot and 25 fps is a target. **Verify the actual sponsor specification, file layout and judging criteria**; this summary is not a substitute for the official brief. The exact FPGA device and requirements are not established. The user wants to try an interactive working module, not merely read a literature survey.

## Files and provenance

- **Primary implementation:** `clearhot-lab/src/components/ThermalClearHotView.tsx`; UI and guidance in `clearhot-lab/src/App.tsx`. This is an isolated evolution of the Idea Studio 2 module.
- `preview/ClearHot_Lab.html` is the built single-file preview. Load a local `.bin` through the browser; the challenge file itself is not included.
- `reference/ThermalClearHotView_original_archive.tsx` is the original archive component. It contains exaggerated claims and should not be treated as ground truth. `reference/ThermalClearHotView_ideastudio2_reviewed.tsx` is an intermediate reviewed version.
- `ClearHot_Test_and_CNN_Exploration_Plan.md` explains what exists and what is untested. Recheck the source and implementation yourself.

Do not modify the user's original raw data. The standalone viewer reads its own local file. Do not download or upload large data, models, or toolchains without explicit permission: the user's workspace may be space-constrained. When real data is essential, ask for a **small, representative, permitted excerpt** or local testing, including how to preserve metadata/format. Do not transfer private content to third-party APIs without permission.

## First: inspect current behavior

1. Map the actual input format, local loader, preprocessing, tone mapping, before/after rendering, frame selection, timing, file size limits and outputs. Confirm all displayed claims against the implementation.
2. The current app assumes full frames of 640 × 512 little-endian uint16 and masks to 14 bits; a correct file length alone does not establish the bit layout or endianness. The file is read completely into browser memory and currently capped at 200 MiB. Check for race conditions and memory consumption before working with large files.
3. Understand why a user may see improvement: the left side is a basic **per-frame min–max** rendering; the right side performs real processing. This is not a comparison to a strong state-of-the-art baseline or necessarily the organizer's reference output.
4. Current line controls operate with Stage 1 enabled. Vertical correction estimates column bias using scene samples; horizontal correction subtracts a local row-mean residual. These can also remove real objects or generate artifacts. Current outlier replacement can affect real small hot objects; sampled column estimates use assumed intensity bounds. Isolate and test these issues rather than assuming they are solved.
5. The preview can process uploaded frames at 640 × 512 but does not prove 25 fps; full sequence export, actual CNN training and FPGA implementation do not exist. Current pixel/tone operations, AGC state, seeking and playback behavior must be independently audited, including reproducibility when a parameter changes on a paused frame, wraparound and frame skipping.

## Investigation and improvements

### A. Establish the artifact and data model

- Ask whether lines run **vertically or horizontally**, are stationary in sensor coordinates, move with the scene, vary over time, and whether 'static' means striping, impulse/salt-and-pepper noise, temporal noise or another artifact. Ask for screenshots or a short local sample and an unprocessed reference when available.
- Distinguish detector fixed-pattern noise from physical scene structures, row/column bias, inter-frame random noise, dead/hot pixels and compression/display artifacts. The input may already be post-NUC, so don't automatically apply a second aggressive NUC.
- Check orientation, endianness, bit alignment, clipping, sample distribution, frame count and any headers against official documentation. Do not infer sensor state solely from a file length or the 14-bit mask.

### B. Implement and compare conventional baselines

- Keep the original raw input and existing preview available. Provide separate, configurable controls for line correction, outliers/denoising, tone mapping and detail enhancement; do not silently overwrite raw files or fabricate measurements.
- Investigate a low-risk, edge-aware row/column offset estimator and, only if suitable data is available, calibration or robust multi-frame estimation. Explain differences and tradeoffs. Test both stripe orientations, large edges, true narrow structures, small hot/cold features, frame motion and scene changes. Prevent corrections from treating real straight features as sensor defects.
- Add defensible, separately toggleable enhancement if warranted: robust percentile tone mapping, smooth temporal adaptation, conservative detail boost, and appropriate spatial or motion-aware denoising. No claim of guaranteed zero flicker/ghosting. Compare with reasonable baselines beyond simple per-frame min–max.
- For usability, consider full-resolution still and full sequence output (clearly document format, dimensions, frame rate, memory and local processing). Avoid a UI freeze or unbounded memory usage: use chunked `Blob.slice`/streaming, workers or other techniques where justified. The user has a Mac; note browser compatibility.
- Benchmark end-to-end **640 × 512**, with timing methodology and hardware reported separately from render-loop measurements. The target 25 fps means ≤40 ms/frame average, but throughput, startup, latency, memory and dropped frames also matter. Never claim real-time solely from a small-downsampled demo.

### C. Evaluate honestly

- Provide deterministic tests using generated 14-bit frames: vertical/horizontal stripes of varying amplitude and frequency, gradients, edges, genuine thin lines/points, moving targets, changing illumination, corrupted pixels, invalid file lengths and byte order. Include a test where an apparent stripe is actually scene content. Establish expected behavior before relying on synthetic scores.
- For real sequences, define before/after comparison using fixed scenes and matching visualization settings, record applied parameters, measure stripe residuals in appropriate flat ROIs and temporal variation after appropriate motion compensation, and inspect preservation of real features and artifacts. Stripe metrics are proxies and can be gamed by oversmoothing.
- Only use PSNR/SSIM or other reference-based metrics when genuine appropriate reference images exist. If reference data or actual sequences are unavailable, say so and provide a reproducible local procedure rather than claiming results. Never describe unlabelled metrics as validated outcomes.
- Keep simulated cases clearly labelled and avoid unsupported 'FPGA-ready,' 'zero artifacts,' 'verified fps,' 'buyer-ready' or 'trained model' claims.

### D. CNN exploration and, if justified, training prototype

- Decide whether training is permitted under the challenge rules and data rights; clarify available Mac model, operating system, RAM, time, permitted datasets, whether clean/noisy pairs or calibration frames exist, and whether CNN inference is allowed in the final submission. Do not assume NVIDIA/CUDA on the user's Mac.
- Consider a small residual CNN operating on linear 14-bit-derived data to remove stripe/noise **before** a separate tone mapper, but compare alternative designs with concrete resource tradeoffs. Keep an unprocessed baseline.
- If no trusted target is available, explain options and their limitations. Synthetic corruption of relatively clean thermal images is suitable for a software demonstration, but is not a validated real-noise model. Noise2Noise-style approaches depend on pairing/statistical assumptions: fixed pattern is often correlated across frames, and nearby video frames differ due to motion. Never assume consecutive frames provide independent clean supervision.
- Split training/validation/test **by recording/scene**, not randomly by adjacent frames or overlapping patches. Where possible hold out sensors, scenes and noise patterns. Freeze a truly held-out evaluation set and do not train on the challenge's test set if prohibited.
- If implementing a proof-of-concept, use reproducible seeds, named dependencies and a small synthetic fixture; include scripts to train, run inference, compare and report, and clearly say when no actual training has run. A simple identity output or synthetic results must never be described as a trained model. Provide CPU/MPS selection where supported, and defer heavy downloads or long training until authorized.
- Evaluate fine-structure retention, motion stability, clipping, hallucinations and downstream utility in addition to apparent sharpness. Quantify full-resolution inference on the user's hardware and compare with the conventional baseline. For FPGA, identify target device and permitted layers first, then assess quantization, memory/line buffers, bandwidth, clock/latency, resource utilization and actual synthesis; GPU speed is not FPGA evidence.

## Desired deliverables

1. An independently verified review of the current code, sorted by severity with exact file/line references and concrete reproduction steps.
2. An improved **separate** working interactive ClearHot version that preserves the ability to load local raw files and compare original and processed output, with clear controls and no hidden external uploads. Avoid overwriting the original ZIP.
3. Tests and a truthful results log identifying synthetic vs real data and anything not run.
4. A concise decision note: best current conventional approach, what data is needed, whether a CNN is worth pursuing, a specific training/evaluation plan, Mac compatibility and an FPGA feasibility gate.
5. Rebuild or deliver an offline-friendly HTML preview when feasible; supply source and clear run commands. Ask permission before large downloads or sharing challenge data.

## Useful references to evaluate, not blindly trust

- PyTorch MPS backend for eligible Macs: https://docs.pytorch.org/docs/stable/notes/mps.html
- Noise2Noise (original paper): https://proceedings.mlr.press/v80/lehtinen18a.html
- Infrared stripe non-uniformity correction research example: https://doi.org/10.3390/app16021052

These references show potential techniques, not that they work on the user's file. Recheck availability, dates, assumptions and relevance.
