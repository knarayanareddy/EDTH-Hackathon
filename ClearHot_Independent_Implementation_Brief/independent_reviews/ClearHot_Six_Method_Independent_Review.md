# ClearHot: independent review of the six-method packages

## Executive summary

The two archives contain **three methods each**, not six proven alternatives. Both build into interactive browser prototypes and contain real conventional image-processing code. The Claude package has the stronger synthetic test/benchmark framework and uses TensorFlow.js for genuine trainable convolutional models. The Argos package offers a useful range of filters and visual controls, but its scores, winner labels and CNN/FPGA claims need more caution than the UI sometimes suggests.

**No challenge-owner thermal sequence, verified format, ground truth, production hardware or FPGA synthesis was available.** Do not select a winner for real-world use, claim real-time throughput, or infer defect/target preservation from this review.

The combined preview is `ClearHot_Six_Method_Workbench.html`. It contains both modified-for-navigation workspaces and six quick-selection buttons. The algorithms are not merged. Its one-file input and frame slider send a browser File and frame number to both workspaces; the source and frame controls inside each workspace remain independently usable and can desynchronize them. Synthetic scenes, metrics, resolution, processing histories and defaults are different across the two packages. Consequently, the two packages' numerical results are not automatically comparable, even on a shared file.

## Inventory

| ID | Conventional line / image work | CNN exploration | Principal caveat |
|---|---|---|---|
| Argos 1 | Edge-gated differential profile correction; rank impulse handling; plateau / difference-of-Gaussians enhancement | Directional filtering with optimized scalar gains | Gradients may gate out actual strong stripes; local edge-retention proxies are not truth. |
| Argos 2 | Haar profile shrinkage / periodic comb; local guided base/detail and contrast | Wavelet-like filtering with optimized scalar gains | Filtering and enhancement can change real edges and texture; FPGA estimates are not verified. |
| Argos 3 | Cross-bilateral profile correction and temporal motion gate; local contrast | Profile-projection filtering with optimized scalar gains | Temporal gating cannot guarantee zero ghosts; loss and gain behavior depend on motion and data. |
| Claude A | Robust spatial local-median profile estimation; CLAHE | DnCNN-lite, TensorFlow.js | Even a true full-height scene line can be mistaken for a stripe. |
| Claude B | Multi-frame averaging and profile estimation; temporal denoise and guided detail | 1-D profile convolution, TensorFlow.js | At sequence start it uses future frames; movement/noise assumptions and memory/compute matter. |
| Claude C | Spectral profile filtering, bilateral denoise and multiscale detail | Directional convolution, TensorFlow.js | Notch filtering is not guaranteed to distinguish scene structure from artifacts. |

Names reflect what the source does or says, not proof that a named algorithm meets textbook or hardware characteristics.

## What I verified

### Archive and build
- Downloaded both Drive ZIPs, checked ZIP integrity and extracted safely to isolated directories. `thermalimageargos.zip`: 18 entries, 268,800 uncompressed bytes. `thermalimageclaude.zip`: 37 entries, 295,493 uncompressed bytes.
- Both projects passed `npm ci`, `npm run build` and `npx tsc --noEmit` in this environment. Node dependencies/build products are not embedded separately in the preview; the two built apps are inlined into it.
- Ran Claude's `tests/pipeline-tests.ts`: all reported PASS, including paused-frame reproducibility, generated stripes, full-resolution processing, input length and endianness. One explicitly records its limitation: a real full-height synthetic scene line was reduced (reported thin retention 0.66 for that particular fixture).
- Re-ran Claude's classical, no-CNN 320×256 synthetic benchmark: six scenarios × three scenes = 18 cases per method. Example average PSNR was raw 29.47 dB, A 38.66, B 39.31, C 38.70. This is **that package's synthetic generator and metric**, not real data and not a comparison to Argos. Synthetic mean thin-retention values were A 0.72, B 0.79, C 0.62, so a higher average PSNR is not a guarantee of detail preservation. Timings are environment-specific, not a 25-fps result.
- Independently ran one TensorFlow.js CPU training step and 64×64 inference per Claude variant: A 1,905 parameters, B 9,041, C 3,167; all outputs finite. This is an execution smoke test only—not trained performance, convergence, WebGL behavior, real-data validation or an independently held-out benchmark.
- For Argos, directly probed all three on a synthetic 320×256 flat image with an alternating-column ±150 ADU offset, using their default processing settings. Stripe RMSE relative to the known flat value was 150 ADU before; after it was approximately 150.0 (1), 150.25 (2), and 142.73 (3). This deliberately narrow test does not establish general failure or superiority; it shows the defaults do not reliably suppress this particular strong-stripe case.
- On a completely flat Argos test frame, the code reported 98.5% thin-feature retention and a 1.2 halo index because those are fallback constants. Neither is an empirical estimate when no relevant feature is available.
- Browser tests of the combined file: all six selectors opened the corresponding real components; one synthetic two-frame 640×512 uint16 file was accepted by both workspaces; the shared frame control selected frame 2; rendered canvas pixels changed between opposite-gradient frames in all six views. Also checked both-workspace layout at desktop and 390-pixel viewport widths and a nested `sandbox="allow-scripts"` viewer. No external HTTP requests were observed in that smoke test. Tests cover only those actions and inputs—not all controls, CNN training, exports or browsers.

## Findings, prioritized

### 1. High — source-format and feature-preservation claims are not established
Both workflows assume 640×512, uint16 and low 14 bits; the shared preview assumes little-endian. Whole-frame file length does not establish endianness, header absence, bit alignment, frame ordering or any radiometric calibration. The Claude workspace independently offers a big-endian toggle; Argos's shared loader is little-endian. If one app's own controls are changed, the shared comparison no longer guarantees identical decoding.

Line suppression can erase real wires, horizons, narrow structures or small warm points. Even a visually clean result can remove useful evidence. Treat PNG and 8-bit sequence output as display output, not radiometric data. The Argos 14-bit export is a single processed intermediate stage, not a calibrated measurement or the complete enhanced 8-bit display.

### 2. High — Argos's built-in ranking and some metrics should not be treated as ground truth
`src/components/AuditAndComparisonPanel.tsx` forms a weighted composite of unlike proxies with hand-picked coefficients and selects a “Best Overall” method; missing metrics get the finite score 9999 and the first entry is still selected if all are absent. It is not a scientifically justified ranking. `src/utils/thermalPipelineEngine.ts` falls back to 98.5% edge retention when it finds no measured edge energy, and to halo index 1.2 when it finds no qualifying halo samples. Its “hot target peak” is computed from the maximum of the 8-bit output divided by 255; this does not measure retained signal from a known target. Scene structure can also contaminate stripe/noise proxies. These caveats take precedence over stronger text in the original UI.

### 3. High — original Argos file changes and seeks can carry temporal history into unrelated frames
The original component keeps AGC/temporal refs across file changes and non-consecutive seeks. In a controlled engine probe, processing the same new synthetic frame with old state versus fresh state changed mean displayed intensity by ~62 levels on the 8-bit scale. This is one reproducible scenario, not a sensor-specific result.

**Preview-only mitigation:** the combined copy resets Argos temporal refs on source/resolution changes and non-consecutive frame seeks, and remounts its instances when a file is loaded. This resets Argos instance settings on each new file. The original Drive archives were not changed. Consecutive frames can still legitimately carry temporal history; history can make two algorithms differ. The change is not a general proof of reproducibility.

### 4. High — Claude B uses future frames at the beginning of a sequence
`src/lib/pipeline.ts`, `destripeB`, sets a full window beginning at frame 0 when `idx` is smaller than window−1. A direct probe at frame 0 requested frames 1 through 11. Its temporal denoiser can also request frame 1 at frame 0. This is valid as an offline look-ahead design if disclosed, but it is not an immediate causal frame-0 implementation. Compare fairly with the same latency/causality constraint; a live implementation must use available past frames, introduce declared delay, or use an explicit warm-up policy.

### 5. Medium — different meanings of “CNN” and training
Claude has TensorFlow.js convolutional models and an optimizer; the one-step CPU smoke test executed, but it does not prove successful learning. The UI describes Claude B as approximately 3k parameters, while the instantiated model counted **9,041** in this test. Confirm hardware arithmetic costs directly rather than relying on labels.

Argos's browser `trainCnnInBrowser` changes four `mixWeights` scalar entries using finite-difference loss estimates; the kernel arrays are cloned but not optimized in that loop. An independent one-epoch check confirmed unchanged kernels for all three and changed mix values. Those hand-built filtering/inference routines and separate downloadable PyTorch examples should not be conflated with training all weights of the named full convolutional networks. Its source comment describes initial held-out validation, but the initial loss calculation uses the training patch; final validation is computed separately. Neither archive delivers a model validated on real sensor data.

Claude's `training/train_clearhot_cnn.py` was **not executed** here because PyTorch is not installed. Its clean-frame path assumes trusted `.npy` recordings and recording-level splits; input provenance, clean-target suitability, MPS compatibility and saved-weight interoperability with the browser all require testing. Noise2Noise-like assumptions are unsafe if persistent stripes are correlated across neighboring frames.

### 6. Medium — performance, temporal behavior and benchmarking limits
Argos loads the whole file into an ArrayBuffer and an additional typed array; its 200 MiB input limit is **not** a 200 MiB memory limit. Claude reads frames by slice but caches frames and synthetic ground truth; compare views process multiple pipelines. The six-method wrapper keeps both workspaces mounted. Large files and full-resolution processing can stress memory and the main thread. No full-file or low-memory stress test was run.

Claude's node tests processed individual full-resolution generated frames in hundreds of milliseconds in this environment; timing is machine/runtime-specific. Argos's stated MACs, line buffers, 25 fps or streaming claims are estimates, not FPGA implementation or timing closure. Any temporal approach needs actual sequential-run, frame-drop, seek and reset tests.

### 7. Medium — the two workspaces do not supply a unified six-way scientific benchmark
The included compare tools differ in generators, ground truth, measurement ranges, metrics, tone mapping, temporal treatment and execution paths. Their composite scores are not on a common scale. The common-file control is convenient for visual review, not proof of apples-to-apples scientific evaluation. Claude B's look-ahead further complicates timing fairness. Preview split-wipes show input and processed display on different halves, while tone mapping and temporal state can make apparent contrast differences misleading.

## Practical recommendation and next steps

1. **Start with Claude A as a transparent classical reference candidate**, and compare C for periodic patterns. This is a development starting point, not a real-data winner. Consider B as an offline multi-frame experiment only after its latency and startup policy are made explicit. Retain all Argos approaches as exploratory candidates; retest them with independently generated corruption and scene-protection cases.
2. Obtain the official file specification and verify width, height, padding, byte order, low-bit alignment, radiometric/NUC state, frame count and metadata against known frames. Confirm the data-use and training rules before using it.
3. Build a common harness around the actual six algorithms: exactly the same 14-bit frames, same resolution, same allowed past/future context, documented warm-up, independently chosen settings, and raw/identity plus the current baseline. Disable all CNNs for the first comparison.
4. Evaluate stripe suppression on independently defined flat regions, scene-feature retention on wires/edges and tiny objects, temporal flicker and ghosting, false corrections on clean frames, clipping and real-time constraints. Use trusted clean reference or simulated corruption where available. Report unknown when no reference exists; do not treat a no-reference proxy as ground-truth image quality.
5. Split CNN data by recording/scene/device. Compare trained vs identity and classical baselines on genuinely held-out sessions; test whether missing line information is invented or scene structure erased. Test persistence and browser/GPU behavior before claiming a working training workflow.
6. Only after software-quality gates: profile end-to-end at 640×512 and the requested frame rate, specify numeric precision and buffering, then implement/synthesize on the actual FPGA and measure timing, resources and I/O. None of that has been done here.

## What changed in the combined preview

- Added parent navigation, single-file forwarding, frame forwarding, ready/status messaging, paused defaults and prominent caveats; both bundled original applications remain visually and functionally recognizable.
- Added the Argos source/seek temporal reset mitigation described above. Other core algorithms were not intentionally redesigned.
- The common input caps files at 200 MiB for compatibility with Argos. Individual in-app controls remain accessible; changing file, endianness, resolution, playback or frame there can desynchronize the common comparison. Argos method settings reset when a new common file is loaded.
- Browser sandboxing can restrict downloads and IndexedDB persistence; the preview alone does not establish that CNN saving works. The shared file never needs to be sent to a server by this preview, but memory use is higher than the file size.

## Reproducibility identifiers

- `thermalimageargos.zip`: SHA-256 `fa73ac869c67abcb368a11dc9ad3d6fa6770d800e9b5634ec2761b3ffa8d8c68`.
- `thermalimageclaude.zip`: SHA-256 `1ccaf596d2091913b6c876dcac9328b184d425680ac8de6fcbb07fa06772e97a`.
- Combined preview at review time: SHA-256 `67be236e9a8f4c4d6dbaa927cd197039ebcc8192ecf9ca17baf533f448ea3740`.

Source code findings refer to the original archives except where the preview-only mitigation is explicitly identified. The workspace contains the isolated review copies and small synthetic probe scripts. No user data or trained models were altered.
