# ClearHot Lab — testing and CNN exploration

## What you have now

`ClearHot_Lab.html` is a standalone browser workbench, separate from the original Idea Studio 2. It reads your chosen file **locally in the browser**, retains the original file unchanged, and exports a single processed 8-bit PNG frame. The new source is in `clearhot_lab/`.

The loader assumes headerless, frame-concatenated **640 × 512 unsigned 16-bit little-endian** pixels, with values masked to the lower 14 bits. Each frame is 655,360 bytes. A compatible file size alone does not confirm endianness, bit alignment, NUC state, frame orientation or the absence of headers. The file is read fully into memory, with an explicit 200 MiB limit; decoding and image buffers require additional memory. For reference, 180,224,000 bytes is 275 whole frames in this assumed format, not proof of the file's contents. No challenge data was downloaded or tested in this session.

Uploaded files default to a **640 × 512** processing preview; uncheck full resolution to use 320 × 256. Synthetic presets are 320 × 256. The left side is per-frame min–max scaling, not the camera vendor's or judges' reference. The processed side inherits the earlier ClearHot-style sampled quantile AGC, experimental column correction, outlier handling and local detail boost. The new horizontal correction is a per-row scene-based heuristic. Playback is a convenience preview, not a 25 fps benchmark. No complete processed video export or FPGA implementation is included.

## Safe first experiment

1. Load the organizers' `.bin`; check the displayed name and frame count. Loading pauses the sequence. Confirm visually that it is the expected data.
2. Start with a scene containing visible lines, genuine edges and small hot objects. Pause on the frame.
3. With **Stage 1 enabled**, move vertical and horizontal strength to zero. Increase the applicable direction slowly: vertical means lines running top–bottom (column correction), horizontal means lines running left–right (row correction).
4. Toggle Stage 1 as a whole to see its combined effect (line correction plus outlier replacement). Note: Stage 1 can replace isolated hot objects as well as defects.
5. Test detail gain, quantile contrast and optional temporal blending separately. Move the split so the same feature is visible on both sides. A high correction setting can remove a true line, create a band, or amplify noise; choose the mildest setting that improves several different scenes.
6. Save a processed PNG, record the frame number and slider settings, then repeat on a static scene, a moving target, a horizon/large edge and a hot scene. PNG is 8-bit and is not a radiometric measurement.
7. For motion, play the sequence from a consistent starting point; AGC and optional blending depend on frame history. The frame slider clears blending history; the automatic contrast is reinitialized when seeking. Comparing a single frame alone does not demonstrate temporal stability.

**Important:** Row/column estimates are inferred from each scene. A strong vertical building edge may be mistaken for a column defect; a true horizon or wire may be mistaken for a row defect. The current column correction uses sampled column means with an assumed 1,000–12,000 ADU acceptance range and fallback; scenes outside this range can behave badly. Calibrated dark/flat-field frames or validated multi-frame approaches may be more appropriate if available.

## How to evaluate improvements

- **Side-by-side visual review:** same input frame, identical output display scale/monitor, compare basic min–max, previous ClearHot settings, and each new setting. Include both large and subtle lines.
- **Detail safety:** check thin lines, hot spots, moving targets, strong straight scene edges and texture. Maintain an untreated original. Look for removed real features, artificial edges, clipping, halos and ghost trails.
- **Stripe reduction:** select multiple flat regions away from scene structure and compare row/column mean profiles and directional spectral peaks before and after. These are proxies and depend on the selected region; real scene edges can resemble stripes. Ideally quantify against calibration/reference data.
- **Temporal behavior:** compare sequences and track fixed-background intensity variation after alignment, contrast jumps and motion trails. It is not enough to report one frame.
- **Performance:** measure complete end-to-end latency and sustained full-resolution throughput, including reads, processing and export on the target hardware, not just browser render time. Separately measure actual FPGA synthesis, memory bandwidth, quantization and latency if needed.

## CNN: practical feasibility

A CNN for infrared stripe non-uniformity correction is a plausible research direction, not a guarantee. For example, a 2026 paper describes a CNN addressing the tradeoff between stripe suppression and thermal detail preservation, using its own dataset and evaluation: https://doi.org/10.3390/app16021052. Its reported results do not establish that a model would work on this challenge file.

### 1. Establish data rights and targets

- Ask the organizers whether their sequences may be used to train models, whether external datasets are allowed, and whether training on an evaluation set is prohibited.
- The strongest dataset would include registered paired corrupted and trusted-reference frames under representative conditions, plus distinct recordings/cameras where possible. Reference quality and any motion-registration errors matter.
- If clean pairs are unavailable, a first controlled experiment can add synthetic stripes/noise to relatively clean thermal frames to generate input/target pairs. It is a **simulation baseline**, and success on synthetic stripes does not establish real-stripe performance. Keep target frames and stripe patterns separate across splits.
- Noise2Noise-style training can sometimes use multiple noisy observations, but it requires assumptions about the noise and pairing. Fixed-pattern stripes often persist across frames and are correlated, so simply pairing neighboring frames does not make them clean targets; scene motion and registration create additional errors. Original paper: https://proceedings.mlr.press/v80/lehtinen18a.html.
- A single sequence with unknown clean ground truth is insufficient to validate generalization. Avoid calling a smoothed or conventionally processed frame “ground truth” without documenting its artifacts.

### 2. A small first experiment

- **Task:** use a compact residual CNN to predict a correction from normalized 14-bit linear image patches, before the separate display tone mapper. Preserve raw data and inputs; define scaling and bit-depth explicitly.
- **Split first by recording or scene**, not by nearby frames or patches. Reserve entire recordings for validation and test; when possible hold out camera/sensor conditions and stripe patterns too. Keep an untouched challenge evaluation set if the rules require it.
- **Baselines:** identity/no processing; the lab's conventional correction; a simple edge-aware/temporal alternative where applicable. Use the same inputs and postprocessing.
- **Loss and tests:** when trusted paired targets exist, compare reconstruction error and edge/small-target preservation; separately inspect residual stripe profiles and motion consistency. Without trusted targets, report no-reference statistics and blind visual reviews as proxies, not PSNR/SSIM against nonexistent truth. Do not use a prettier output alone as the success criterion.
- Record data permissions, exact split, preprocessing, random seeds, model/version, settings, train/validation/test metrics, failure examples and inference time. Watch for overfitting and visually plausible invented or missing details.

### 3. Mac and deployment

A Mac can run a small PyTorch experiment on CPU or, where supported, the Metal/MPS backend. Check the actual Mac model, available memory, macOS version and framework support before promising speed. PyTorch MPS docs: https://docs.pytorch.org/docs/stable/notes/mps.html.

For the FPGA, a trained CNN introduces an additional implementation project: target-specific operator support, fixed-point quantization, model weights, buffering and external memory, bandwidth, latency and synthesis. Begin by determining whether a CNN is permitted/necessary, and benchmark a conventional full-resolution baseline. Do not equate a laptop or browser result with FPGA feasibility.

## Validation completed for this lab

- Build and TypeScript check passed.
- Chromium loaded a deliberately invalid file and rejected it; loaded a two-frame *generated* 640 × 512 striped sequence; confirmed full-resolution rendering and frame navigation; verified that both line controls change output and reduce differences in that constructed pattern; exported a 640 × 512 PNG; checked tab state retention and mobile page width. No page errors were observed.
- Standalone HTML navigation worked through a `file://` URL with external HTTPS blocked.
- These are software smoke tests, not evidence of improvement on the organizers' real dataset, objective quality, real-time throughput, CNN performance or FPGA readiness.
