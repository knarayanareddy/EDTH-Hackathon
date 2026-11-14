# ClearHot: independent evaluation and improvement brief

## Brief for both agents

You are receiving two source packages, `thermalimageargos.zip` and `thermalimageclaude.zip`, which contain three thermal processing methods each. Also read `ClearHot_Six_Method_Independent_Review.md` and, if provided, use the combined six-method preview as a navigation aid. The user has viewed a ~180 MB sample file; **visually, Argos instance 2 currently looks best to them**, but that is a subjective observation, not an independently established winner. Do not claim you have seen or evaluated their sample unless you actually did.

The user received feedback that animals and bridge structures can appear similarly bright, making the scene hard to interpret, and was asked to explore digital detail enhancement. The task is to investigate and improve useful contrast and detail **without inventing thermal differences, suppressing thin structures, or making unverified operational claims**.

### Non-negotiable data and physics rules

- Treat 640×512 headerless uint16, little-endian, low 14-bit assumptions as hypotheses until confirmed from the official sensor/file specification. Matching file size does not establish format. Do not claim raw ADU values are temperatures or calibrated radiance without documentation and calibration.
- An animal is not guaranteed to have a higher apparent surface signal than a bridge. Surface temperature, fur, solar heating, emissivity, reflected radiation, atmospheric effects, distance, point-spread function, sensor calibration and saturation can affect appearance. Explain what is observed; do not brighten pixels merely because an object is identified as an animal. FLIR explains the role of emissivity and reflected radiation in apparent temperature [3](https://www.flir.com/discover/professional-tools/top-5-mistakes-that-new-thermographers-make/).
- If meaningful differences are present in raw sensor values but disappear in display processing, examine tone mapping, clipping, quantization and local contrast. If the raw measurements do not distinguish two regions above noise/uncertainty, enhancement cannot recover a trustworthy physical temperature difference; identify that limit rather than hallucinating it. A locally adaptive display can alter relative brightness between locations: label display pixels as display intensity, not temperature.
- Preserve a raw/linear reference path and provide a global monotonic display option with a fixed, user-selectable window and no spatially varying enhancement when comparing intensity ordering. Check the monotonicity of the actual selected mapping, including clipping and quantization; equality is not a strict ordering. Show local enhancement as a separate, clearly labeled interpretive view, not a temperature measurement.
- Do not send the full ~180 MB file to third-party services. It should remain local unless the user explicitly approves. Report memory use and deal with the file by slicing/streaming; the combined preview's 200 MiB cap is not a 200 MiB RAM bound.

## Phase 1 — independent evidence before redesign

1. Inspect and run both original source packages. Verify current controls, upload decoding, default configuration, selected resolution, actual displayed pipeline, and whether CNN is active. Retain Argos 2 as the user's visual reference, alongside input/identity and original baseline. Do not silently alter or replace the six original implementations.
2. Confirm from the user which frame ranges contain the relevant animals and bridge and obtain any available independent scene or temperature reference. Preserve original data and record file hash locally when permitted, frame indices, configuration and algorithm version. Do not export or transmit identifying scene data without permission. Compare the **same frame** from a confirmed common decoder and full resolution across methods; ensure matching bit order, playback position, reset policy and documented causal/look-ahead context. Note Argos temporal state issue and preview mitigation from the review; Claude B can access future frames at startup.
3. Add an optional local, manual ROI measurement tool. For user-selected animal, nearby background and bridge regions, report raw ADU median, spread, saturation/valid-pixel fraction, and relative background contrast; also report post-line-correction ADU and display 8-bit metrics separately. Avoid implying ADU equals °C. A region can contain mixed pixels or movement; prompt for multiple examples and record ROI sizes. A contrast-to-noise statistic, e.g. |median(ROI)-median(local background)| divided by a robust background-noise estimate, is a proxy—not evidence of true temperature, and its validity depends on local texture/noise.
4. Perform stage-by-stage ablation: raw fixed-window, line correction only, tone map only, detail enhancement only, combined stages; then CNN off/on separately. Use reproducible settings, show clipping fractions and difference images; keep independent raw and processed numeric data. Explain whether loss of separation is already present in the sensor data or introduced later.
5. Check line reduction on suitable flat areas; retained fine structures, animal outline/interior details, distortion/halos, edge overshoot, hot/cold clipping, temporal flicker and ghosting. Do not optimize solely for stripe/noise proxy or visual contrast; both can be gamed by smoothing or artificial sharpening.

## Phase 2 — implement and compare candidate enhancements

Build a *separate experimental copy* starting from Argos 2 and appropriate alternatives. Preserve a selectable unmodified baseline. Prioritize candidates as hypotheses:

- Carefully tuned edge-aware base/detail decomposition (guided or bilateral): enhance detail with bounded gains and noise-aware coring; evaluate thin-feature preservation and boundary halos. A guided-filter/multiscale approach is reported in the literature, but the paper's results do not establish performance on this user's file [1](https://doi.org/10.3390/fire7060192).
- Global monotonic percentile/window mapping and controlled highlight compression, with a locked-scale option. Compare before/after to detect quantization, saturation, loss of global brightness ordering, scene jumps and flicker.
- Carefully blended, contrast-limited local histogram enhancement, with adjustable clip limit and tile scale. Its ability to amplify noise or distort relative local brightness needs measurement; do not assume it always helps [2](https://pmc.ncbi.nlm.nih.gov/articles/PMC11120493/).
- Where video is available, evaluate causal temporal stabilization with a declared warm-up, scene-change reset, motion gates and latency; test motion and rapid scene changes for ghosting. Optional offline look-ahead must be explicitly labeled and benchmarked separately.

Offer independent, labeled knobs and reasonable resets; show a shared 14-bit input with identical frame/time and resolution. Allow a raw-versus-processed view and a safe bypass. Do not assert that an object becomes physically hotter because the UI is brighter. Don't modify the source file or replace exports without clear format labels.

## Phase 3 — defensible independent evaluation

- Freeze method configurations before evaluating held-out material; record exact code hash, parameters, decoder, version, resolutions, hardware, reset rules, latency and frames. Avoid tuning thresholds repeatedly on the final test.
- A single recording does not establish cross-scene generalization. With only this one file, separate development and held-out **contiguous time blocks**, avoid overlapping windows and exclude boundary frames that leak temporal context; label results exploratory because nearby frames are correlated. Seek separate recordings, environments and camera conditions for a genuinely independent assessment.
- Test a random, repeatable sample of frames/clips covering different backgrounds, bridges, animals, line directions/strengths, low contrast, motion, bright and dark scenes and hard negatives. Include no-stripe and full-height genuine lines so preservation failures are visible. Do not cherry-pick only Argos 2's preferred frame.
- Use generated cases with known clean ground truth to report PSNR/SSIM and known defect/structure retention, and separately evaluate real data with appropriately labeled no-reference measurements and uncertainty. **Do not calculate or claim ground-truth PSNR for an unlabeled real file.** Lower stripe metrics or sharper appearance alone do not prove improvement.
- Conduct blinded randomized A/B preference review of identical frames, with neutral method labels, multiple reviewers if available, predefined criteria and ties. Keep the user's existing Argos 2 preference as an observation, not an independent blind test. Provide per-scene examples, disagreements and confidence limits if sample size supports them; avoid a universal winner when results trade off.
- Measure full-resolution p50/p95 processing latency, frame drops, peak memory, warm-up and artifacts in browser on the actual Mac. 25 fps requires the full system to sustain the relevant frame budget, not just a JavaScript step's timing. Do not infer FPGA feasibility without a specific device, implementation and synthesis.
- Supply a reproducible table, exact commands, honest test failures, before/after sample outputs where permission permits, and concise findings. Recommend the best setting per use case only if the evidence supports it.

## Phase 4 — CNN: make the status honest; propose, don't assume, a feedback loop

- The current Argos browser routine changes four scalar mixing/gating values via finite-difference optimization on synthetic patches; kernel arrays are not trained by that loop. Its separate PyTorch examples are not the same thing as a validated model. Verify claims and labels.
- The Claude package uses TensorFlow.js models. Training starts when the user requests it and uses generated scenes/noise, not automatic supervised learning from their ~180 MB file. It applies the in-memory model after training; model persistence can be unavailable in a sandbox. A one-step CPU smoke test showed the three models execute; that does not establish usefulness. Its separate PyTorch script was not run in the prior review.
- Show whether a model is trained, the exact model/weights identity, dataset provenance, number of optimization steps, loss and validation method, whether it is applied, and whether saving succeeded. No automatic background training or silent replacement of the classical pipeline.
- Propose an offline feedback loop: curated recordings and trusted targets or explicitly simulated/validated corruption → split **by recording/scene/device** → train → validate/tune → evaluate once on an untouched test set → review failure cases → version/checkpoint → opt-in deployment with rollback. If there is just one recording, state the limitation and avoid claiming independence.
- Explore uncertainty-gated classical fallback, test against identity and classical methods, and measure harmful feature removal as well as noise reduction. Adjacent frames are not automatically valid Noise2Noise clean targets because fixed-pattern stripes can persist across frames and motion can misalign scenes; the assumptions of Noise2Noise need verification [4](https://proceedings.mlr.press/v80/lehtinen18a.html).
- Do not represent user clicks, single-frame preferences or a decrease in training loss as proof that the neural model has improved. Confirm challenge rules before training on provided data; no claims of performance without a held-out evaluation.

## Deliverables requested from each agent

1. A working separate experimental source folder and runnable local preview, with the six original variants and clearly named new variants. No changes to the user's original archive without permission.
2. A concise audit separating implemented code, tested behavior, assumptions and untested claims; list every change and how to turn it off.
3. A reproducible evaluation script and report covering the checks above, sample-only vs holdout distinction, failure cases, and latency/memory on the tested device. Do not invent sample results; clearly label anything synthetic.
4. A side-by-side recommendation of the most promising conventional improvement and whether CNN training is justified **by evidence**, not labels.
5. If another agent has produced a competing proposal, review their results independently and reproduce the tests rather than simply agreeing. Coordinate a frozen common benchmark before comparing rankings.

## Material to provide to the agents

- Both original ZIPs: `thermalimageargos.zip` and `thermalimageclaude.zip`.
- The independent review and the integrated preview/source package, if available. The preview includes a temporal-reset patch to Argos; original source archives do not. Compare source versions carefully.
- The official file specification; if permitted, local access to the sample or a short, correctly framed sample rather than a bulk transfer. User can provide frame ranges and their own qualitative notes.
- The user's Mac model/available memory, the desired display/latency constraints, and whether eventual FPGA deployment is required.
