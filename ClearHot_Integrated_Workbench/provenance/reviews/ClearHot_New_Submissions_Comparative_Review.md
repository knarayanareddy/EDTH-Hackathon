# ClearHot: independent review of the two new submissions

## Decision in one page

**Recommendation: use Claude's submission as the safer development base, while keeping the previously tested ClearHot player as the fallback. Do not treat either submission as a finished, trustworthy real-footage self-improvement system.** Argon contributes useful ideas and working synthetic training code, but its delivered standalone HTML is broken, and its evaluation, cache synchronization and model registry have independently reproduced correctness defects. Claude's player and cache interface performed better in my synthetic browser checks, and its safety gates fail when required evidence is missing. But its downloadable archive is incomplete, its actual Python training and inference could not be independently reproduced in this environment, its own sample model fails important default feature-retention gates, and its real-data import lacks the masks needed to pass the mandatory gates.

There is **no evidence yet that either model improves your recording**, distinguishes animals from bridges more reliably, or preserves important details. Their synthetic scores are not directly comparable: the datasets, architectures, metrics and training procedures differ. Neither Mac hardware nor your private footage was tested. Both add meaningful prototype work, but neither meets the full assignment today.

### Quick comparison

| Criterion | Claude (`clearhotcl.zip`) | Argon (`clearhotar.zip`) |
|---|---|---|
| Delivered local HTML | Opens and passed inherited synthetic player/browser checks here | **Broken as shipped:** blank page, JavaScript syntax error. Rebuild with unmodified build script also broken |
| Original six methods / existing workflow | Retained; original Argos engine files byte-identical to the supplied baseline | Retained in source; browser checks passed **only after my diagnostic build fix** |
| Learning | Real PyTorch residual CNN and backprop source; Python results not independently reproduced here | Hand-coded residual CNN, manual backprop and Adam; independent synthetic training did change weights |
| Iteration | Train/evaluate/approve/reject/rollback source; trains fresh model each time rather than resuming active weights | Two-cycle synthetic demo independently ran; supports initialization from checkpoint, but active checkpoint identity can be overwritten |
| Gate behavior | Missing line/target masks and stripe-free examples fail their gates; real import currently produces no masks | **Fails open:** missing stripe-free samples and thin-feature masks can be reported as passing |
| Playback / cache | Synthetic fabricated cache attached, played all 4 frames, mismatch correctly rejected; actual saved-weight inference-to-browser not reproduced | Cache workflow exists, but wrong-source cache accepted and non-default source decoding corrupts displayed cached output, even after build fix |
| Real-data readiness | Real trusted-pair import, but no mask import, so relevant mandatory gates cannot pass | Real-pair import and attestation exist, but safety gates and provenance/registry defects make acceptance unsafe |
| Package reproducibility | Three Node tests fail due to missing artifacts; archived checksum list is stale | 26 Node tests pass; original package lacks lockfile and no `npm test` script; passing tests did not catch the broken browser artifact |
| New non-CNN enhancement | Author acknowledges no genuinely new classical candidate or isolated ablation | Adds classical/causal variants and ablations; actual improvement on your recording not tested |
| Mac / private recording | Mac and actual recording not tested; author documents this | Mac and actual recording not tested; no demonstrated field evidence |

**Status:** this is a comparative code, synthetic and browser review—not a product certification, privacy audit, Mac test, or demonstration with your footage. Timestamps inside the supplied files and logs are author-provided; no inference about authenticity follows from them.

## 1. What I actually checked

- Retrieved and integrity-checked both Drive ZIPs and safely extracted them. SHA-256 of the downloaded archives:
  - Claude: `e7f83fcad15c19173570e452e716d10bda83994b3c2b82dcea755938f4341637`
  - Argon: `6cca68583b066d08893177b3cbd92d3bbfd5a0d9f27e26d70d250284cd1938af`
- Read the common assignment, the existing player, documentation, viewer, decoders, training/evaluation, model registry, cache paths and tests. Compared original-engine hashes with the supplied working baseline.
- Claude: clean Node dependency installation, build and typecheck passed. Node tests **15 passed, 3 failed** because two tests expect missing reference ZIPs and one expects a missing synthetic recording. The inherited browser checks passed: 12-method review, blind ratings/export, generated 640×512 file handling/hash, five-frame playback, seek and restart. A separate four-frame synthetic **fabricated cache** exercised attach, playback through the last frame and wrong-source hash rejection with no observed page errors or HTTP requests. The fabricated cache is an interface test, not a CNN inference result.
- Argon: Node installation, build command, typecheck and **26/26 Node tests** passed. The original HTML nevertheless fails to execute. After a narrowly scoped local diagnostic build-script fix, the same inherited browser checks passed; the fixed file is **not** what was delivered. I independently ran its generated two-cycle synthetic demo, and a separate fresh generate/verify/train/evaluate cycle. I reproduced wrong-source cache acceptance, incorrect decoding of a cache generated from a big-endian shifted input, false safety-gate passes, and overwriting of an active model by a new candidate using the same ID.
- I examined Claude's included results but did **not** rerun its Python CNN: the environment has Python 3.13 and no PyTorch; its supported instructions specify Python 3.11/3.12 and PyTorch 2.5.1. Installing the large dependency stack was avoided. Its reported Linux results are attributed to the authors, not independently verified.
- Browser checks are limited tests, not proof that no software could ever communicate; dependencies must be downloaded during setup. No private recording, hardware, Mac, Apple MPS or full-length real-video performance test was used.

## 2. What the supplied working pipeline already did

The common baseline was a local self-contained comparison/player with the six original configurations, additional lab configurations, an unchanged Argos 2 reference, blind rating, ROIs, session export/import, and sequential playback. It can inspect the whole recording frame by frame without intentionally dropping frames, though playback speed depends on the machine and method. Playback interruptions and seeking restart temporal context. The raw/common reference uses a fixed window; original methods can use their own native display mapping. A prettier or brighter image is not automatically a better or more faithful measurement. Your preference for Argos 2 is a sensible starting point, not proof of performance on all scenes.

The prior baseline was synthetic-tested, but **your file and Mac were never independently checked**. Do not interpret raw sensor counts as temperatures without appropriate calibration. The request was to preserve this working experience while adding local, evidence-driven improvement and a complete usable-video workflow—not just train a model on a toy dataset.

## 3. Claude: strengths and remaining problems

### What it genuinely adds

- A five-convolution PyTorch residual network, an offline dataset generator and trusted-real-pair import, candidate evaluation against raw and the original Argos 2 stage-1 count-domain output, candidate registry, explicit human approval, rejection and rollback, and a local inference-cache/player path.
- The original Argos `thermalPipelineEngine.ts` and `cnnPrototypeEngine.ts` match the supplied baseline byte for byte. This supports preservation relative to our supplied handoff; the archive omitted the original reference ZIPs, so the submission's own ZIP-based parity tests could not be independently run.
- When the evaluator has no stripe-free example or no valid feature masks, the corresponding mandatory gates fail rather than inventing success (`training/clearhot_cnn/evaluate.py`). The viewer calculates the selected recording's full SHA-256 and checks cache source, decoder, length and cache hash before attach. A four-frame independent interface test rejected a same-size recording after one byte was changed.
- The player displays the common-window raw, Argos 2 counts and cached CNN output, alongside Argos 2's native display. Its bypass hides the CNN output, and changed source/decoder detach the cache. A manifest's approval metadata is still locally supplied information, not cryptographic proof of independent approval.
- Its inference code estimates disk use and checks free space, streams frame outputs, asks for consent where appropriate and refuses a nonempty output directory. Its documentation explicitly says Mac/MPS and real footage were not tested.

### Significant limitations

1. **The delivered ZIP is incomplete and its recorded test report is not reproducible from the files as received.** `provenance/reference_submissions/thermalimageargos.zip` is missing, as is `build/e2e/recording.u16`; 3 of 18 Node tests therefore failed. Demo dataset `.npz`, model `.pt`, recording and cache frame binaries are also absent; metadata and prior logs remain. A generator is provided, so this does not prove the missing files cannot be regenerated in a correct environment, but the supplied log claiming 18/18 is not the result of testing the received archive here. Its `SHA256SUMS` is stale: five files in the original ZIP—including HTML, app/core source and decoder—do not match that list. A stale checksum list is not by itself proof of tampering; regenerate an accurate manifest and make provenance explicit.
2. **Its own synthetic demo does not establish a safe default model.** In the author's logs, cycle 1 failed default line and target retention gates: minimum retention about 0.117 and 0.533, against the default lower bound 0.70. The demo then used explicitly test-only relaxed thresholds (line lower bound 0.05, target 0.45) to exercise simulated approvals. That is useful workflow testing, not proof of detail preservation. The logs also show a deliberately bad model rejected and a later rollback; these results have not been independently rerun here.
3. **Real-data acceptance is blocked by design at present.** The real-pair importer sets all masks to zero, so the default line/target/halo evidence cannot be supplied through that import. The conservative behavior is preferable to false passing, but it means you cannot complete the required real-data promotion workflow until mask import/annotation and evaluation are implemented. A trusted, aligned reference in the same count domain is also a substantive user-supplied requirement, not something the current recording alone guarantees.
4. **Improvement is not continuous training from the current active model.** The CLI's `train` creates a new network and optimizer; it does not expose a resume/init-from-active option. The user can iterate by retraining candidates and comparing them, but this is not incremental learning from the previous approved checkpoint. No automatic improvement should be claimed.
5. **Viewer integration is not fully proven end to end here.** I tested a fabricated four-frame cache, not actual inference from a saved checkpoint. I did not reproduce the requested saved-weight-to-browser sequence beyond frame 60 or full-resolution inference. The supplied Python and test logs are useful leads, not independent verification.
6. **Scope gaps:** the author says there is no genuinely new classical candidate/isolated ablation. Everything is 14-bit in the supported count domain; other bit-depth/layout assumptions need work. Threshold overrides can be passed through the CLI, so the reviewer must inspect the actual thresholds and test-only marker rather than assuming a green label means the defaults were used.

### Mac practicality

The documented path requires Node 20+ and Python 3.11/3.12, NumPy and PyTorch. The README recommends Apple Silicon; the pinned PyTorch version has no Intel-Mac wheels according to the submission. Software installation downloads can be substantial (the README estimates roughly 100–250 MB download and 0.5–1 GB disk; unverified on Mac). CPU is default; MPS is optional and was not tested. The player itself can be opened locally without uploading the file. Cache files and exported sessions can contain sensitive information and must remain local or be deliberately shared.

## 4. Argon: strengths and independently reproduced defects

### What is useful

Argon implements a small hand-coded 538-parameter residual CNN with backward pass and Adam, dataset validation, synthetic generation, optional initialization from checkpoint, evaluation, an explicit model registry and local inference cache. It also adds non-CNN/classical variants and stage ablations that Claude acknowledges it did not deliver. Its two-cycle demo ran here: simulated promotion, deliberate rejection, subsequent simulated promotion and rollback all executed on synthetic material. Cycle 1 reported 59.159 dB CNN PSNR versus 53.853 dB Argos 2 stage-1 on its own synthetic fixture; those are synthetic, dataset-specific measurements, not evidence about your recording.

A separate generated 64×64 dataset validated file hashes and split checks; two training steps updated the weights and validation loss. Evaluation rejected that particular candidate because its halo gate failed. This demonstrates actual computation, not real-footage success. Dataset/target attestations cannot prove that scenes are independent or references are physically correct.

### Critical defect A — delivered standalone page does not run

The HTML inside the original ZIP raises `Unexpected token '&'` and renders a blank page. `node --check` on its extracted inline JavaScript confirms invalid syntax. The cause is `build.mjs` placing bundled JavaScript into `String.replace` as a replacement string: `$&` within the bundle is interpreted as a replacement token and inserts `/*SCRIPT*/` into JavaScript. The build command completes successfully even though it produces broken HTML. A replacement callback avoids the replacement-string expansion; I temporarily used that locally **only to diagnose the remaining defects**. Do not confuse the repaired review copy with the submitted artifact. Build success and 26 passing Node tests did not validate the page users actually open.

### Critical defect B — cache from the wrong source accepted

After the diagnostic build repair, I generated a cache for a 75-frame synthetic recording, changed a pixel in a same-sized copy, loaded the changed recording **without first clicking the hash button**, and attached the original cache. The viewer reported `Verified local inference cache (75 frames) synced to player` and displayed it, although the source SHA-256s differed. In `src/app.ts`, compatibility uses `requireSha256Match: !!fileHash`; if a file hash has not already been calculated, hash matching is not required. A check of size, geometry and frame count cannot establish recording identity. The cache must be blocked until the full source hash has been computed and matched, and invalidated on source/config changes.

### Critical defect C — cached pixels are corrupted for supported non-default source formats

I generated a one-frame 64×64 big-endian, shifted-by-one source and used Argon's CLI to produce a cache. The cache stores little-endian decoded 14-bit counts, but the viewer decodes the cache using the source's big-endian and shift settings. All 4,096 pixels differed from correct cache interpretation; mean absolute difference was approximately 4,907 counts. In the browser the first correct count was 5,967, which should map to approximately 60 on the 5500–7500 fixed window; the cache display showed 255. The UI nevertheless reported the cache verified. Cache storage encoding must be specified and decoded independently of the source input encoding.

### Critical defect D — missing evidence can pass mandatory gates

I evaluated synthetic pairs with `wireMask` removed and with no samples carrying the stripe-free-negative scenario tag. The evaluation returned **pass** for no-stripe false correction at 0 ADU and thin-feature retention at 1.0, and `allMandatoryGatesPassed=true`. In `src/cnn/evaluator.ts`, empty evidence is replaced with favorable defaults. This is a false assurance: a missing test is not a passed safety test. Gate outputs need sample counts, explicit `not evaluated`/failure for missing evidence, and promotion must fail closed.

### Critical defect E — a candidate can replace the active model without approval

Using a copy of the synthetic demo registry, I trained another candidate with the **same ID as the active checkpoint**. The registry retained `activeCheckpointId = ckpt-cycle1-synth-v1`, but the corresponding record changed from status `active` and weight hash `a51d…3951` to status `candidate` and a different weight hash `3f12…53d`. The code assigns `state.checkpoints[ckpt.checkpointId] = copy` without rejecting duplicate IDs. Running `infer-cache` against that registry then wrote a manifest with `checkpointStatus: candidate` **and** `isApprovedActiveModel: true`, because it treats the active pointer as proof of approval. This breaks the core requirement that unapproved weights cannot silently replace an approved model. IDs should be immutable, approval should bind to the exact weight and report hashes, and loading/inference must validate consistent state.

### Other material issues

- Registry save writes several files directly with `fs.writeFileSync`, rather than implementing a crash-safe atomic transaction across registry and active state. A successful synthetic rollback is not evidence of crash-safe atomic promotion or rollback.
- `infer-cache` reads the full recording into memory, constructs the full cache in memory, then writes output files directly. It reports predicted disk use and asks for consent, but an existing prefix can be overwritten. Avoid using it on an irreplaceable path; memory and runtime on a 180 MB recording/Mac are unmeasured.
- Final-test invocation is logged, but code permits repeated unlock/invocations; an audit log does not technically preserve an untouched holdout after repeated use. Repeated tuning against it invalidates the interpretation.
- A cache is preferred over a loaded checkpoint in the runner; model selection/cache precedence and status must be visible and independently verified. A manifest boolean is not evidence of genuine model approval.
- The original ZIP lacks a dependency lockfile; `npm install` generated one locally. There is no `npm test` script, although `node --test tests/*.test.mjs` ran the 26 tests. The tests' success does not outweigh observed failures in the shipped artifact.

## 5. Assignment coverage and what remains

| Required outcome | Assessment |
|---|---|
| Preserve local comparison and useful original methods | **Partial:** Claude passed synthetic checks and original-engine hash comparison. Argon source retains methods but shipped page is unusable until fixed. |
| Improve thermal detail vs Argos 2, preserve thin/small targets | **Not demonstrated** on your footage for either. Argon adds classical candidates; Claude demo's default feature gates fail. Synthetic scores are only within-fixture evidence. |
| Real offline training and manual controlled iteration | **Prototype / partial** in both. Synthetic Argon run independently confirmed. Claude's Python workflow is present but not independently executed here. Neither has a proven end-to-end real-data iteration loop. |
| Safety gates, approval, reject, rollback | **Partial in Claude**, pending real mask support and independently reproducible tests. **Unsafe in Argon** due to false-pass gates and mutable active IDs. |
| Local cache tied to exact source/model/frame | **Claude interface partial:** synthetic wrong-source rejection passed, actual inference-to-browser unverified. **Argon fails** wrong-source and non-default-decoder tests. |
| Show complete video, raw / Argos 2 / candidate | Classical synthetic sequential playback tested for both after Argon diagnostic fix. Claude fabricated-cache test covered four frames; Argon cache correctness defects prevent trusting output. Neither completed the full >60-frame actual saved-weight-to-player acceptance test independently here. |
| Real reference data / masks / independent holdout | Not supplied. Neither proves a usable clean target can be derived from the user's one recording; arbitrary adjacent frames, denoised outputs, or model predictions are not automatically ground truth. |
| Mac / real 180 MB file | Not tested. No promised frame rate, memory peak, compatibility or measurable improvement. |
| Local/private operation | Designed for offline local execution and restricted browser connections. Normal synthetic browser runs showed no HTTP requests; this is not a complete security audit. Installation downloads software; saved caches, frame excerpts and metadata are sensitive. |

## 6. Practical next steps

1. **Preserve the original file and known-working player.** Work on copies of the code, keep the original recording read-only, and keep caches on local disk. Do not distribute session exports, extracted frames, cache files or hashes without deciding whether they are sensitive.
2. **Repair and reproduce Claude first.** Request a corrected, self-contained ZIP with reference assets or clearly regenerated equivalents; a fresh manifest; one-command clean-machine setup; and honest platform-specific logs. On the Mac verify the existing viewer first, then regenerate the synthetic demo and run actual checkpoint → cache → player for more than 60 frames, seek and bypass, including wrong-source and decoder tests. Report installation size and memory/time measured on that Mac.
3. **Complete safe real-data evaluation.** Implement local feature/target/ring/stripe-free annotations or importable aligned masks, verify sample counts and fail closed for missing evidence. Define dataset versions and independently held-out sequences before tuning. Obtain a genuinely trusted aligned reference if count-domain supervised improvement is claimed. If no such reference exists, use a conservative classical exploration and blinded visual review; do not relabel self-generated output as clean truth.
4. **Evaluate the actual use case rather than optimize PSNR alone.** Select representative animal-like shapes, bridges, thin lines, flat backgrounds, movement, occlusion and difficult brightness overlaps. Freeze decoder, settings and data split. Compare raw, unchanged Argos 2 and candidates on the same frames, including both native view and common fixed-window count output. Blind visual ratings and inspect for lost small features, halos, flicker and false structure. Reserve a genuinely untouched final sequence for a later one-off assessment.
5. **If borrowing Argon features**, insist first on tests reproducing and fixing all five critical defects above; add immutable content-addressed checkpoint identity, strict source/cache checks, explicit cache dtype, fail-closed gates, crash-safe writes, output overwrite protection and tests against the actual built standalone HTML. Its classical candidates can be considered as experiments, not established improvements.

### Honest decision now

Keep using the previous player for viewing, and choose **Claude as the basis for further engineering**, not as a finished deployment. Ask for a corrected and independently reproducible release before investing time in training. Use Argon selectively for ideas only after its blocking defects are fixed and retested. The next useful milestone is a reproducible local synthetic checkpoint-to-full-sequence demo and a credible plan for evaluating *your* recording without sharing it—not another claim of self-improvement.
