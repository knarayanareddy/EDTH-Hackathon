# ClearHot integrated workbench — research prototype

This package combines the local player, **actual original classical engines**, manual tuning/presets, blind review, two separately labeled Argon-inspired experiments, and an optional offline CNN command-line system. It is not a validated operational system, calibrated thermometer, or proof of improvement. Your actual video and a Mac were not available during this build. See `RESULTS_AND_LIMITATIONS.md` and `FEATURE_HISTORY.md`.

## Start viewing on your Mac — no installation required

1. Extract the ZIP, open `ClearHot_Local.html` directly in Chrome or Edge. It is a self-contained local page. No account, server or recording upload is needed for normal viewing. The recording is read locally, not included in the ZIP.
2. In **Source**, choose your recording. Confirm dimensions, byte order, one-time file header, and bit shift against the sensor format if possible. The 640×512, 14-bit-in-uint16, little-endian, no-header defaults are only a hypothesis. Formats with packed pixels, per-frame headers, row padding or >14-bit values are not supported. Use **Apply decoder & window**. If the image is dark/white, use **Suggest window from current frame**; check visually against a trusted viewer. Equal file division is not proof of correct decoding.
3. In **Video playback**, select Argos 2 original or another method, choose a target FPS, and play, pause, seek or restart. Frames are processed sequentially without deliberate skipping; if processing cannot keep up, playback is slower than the target. Original Claude B can use future frames; it is not causal live streaming. Seek/pause/restart resets temporal state. Your Mac's speed is unmeasured.
4. The raw view is fixed-window. Original method outputs have their native, potentially different AGC/tone; they are not automatically comparable as if in the same physical domain. Counts are not temperature.

## Tune and compare

1. In **Explore and tune**, choose an original method (Argos 2 selected initially). Adjust its actual engine configuration with a number or slider. The original defaults are not modified. Some controls depend on a parent stage being enabled. With Argos 2, Stage 4 alone does **not** disable its fused guided detail; the implementation does not have a clean isolated switch for that. Turn off *method-specific enhancement* to bypass that whole branch, which changes more than detail.
2. Set a preset name and **Save preset locally**, or **Export preset JSON**. Browser-local storage can be cleared or unavailable; export a JSON backup. Loading a preset restores method parameters, not the recording or decoder/window. Applying changes requires replay/show-frame; controls are locked during playback and frozen plans.
3. Click **Compare tuned vs original and play**: raw, tuned and unchanged default of the same method are rendered on the same sequence. For a still, select `Compare: raw | tuned | original default`, then click **Show selected method on this frame**. Both methods have separate temporal state; a new play/seek starts both fresh. Your tuned result is not automatically better.
4. To include the tuned result in blinded still-frame review, check **Include tuned preset as extra blind candidate when frozen**, then **Freeze settings**. The frozen snapshot becomes a 13th candidate alongside the 12 baseline configurations. Add ROIs, run, rate, record and export. Without the checkbox there are 12. Settings/decoder and tuned controls are frozen; split labels do not establish independent data. The export contains preset parameters, source metadata and blind mapping; handle as sensitive.
5. Optional `EXPERIMENT` choices in the playback dropdown are derived from Argon's new guided/cored and causal temporal candidates, not original Argos 2. Their own tone uses the fixed window and a soft knee. They have only synthetic execution/reset tests, not rigorous safety or real-video evaluation. Do not treat them as improvements or operationally validated.

## Optional learning — separate from viewing

This is an **experimental local CLI**, not automatic learning from sliders, ratings or unlabeled frames. It is based on Claude's PyTorch implementation. It requires trustworthy, aligned target data, separate training and validation recordings, feature evidence, explicit review, and suitable dependencies. It will not improve on every cycle. Do not use demo-approved models as evidence on your video.

The following is an **untested-on-Mac** development setup, for Apple Silicon, Python 3.11/3.12 and Node 20+. Installation downloads software, including a large PyTorch package; the complete installed environment may occupy hundreds of MB or more. The original author reported Intel Mac incompatible with the pinned PyTorch version. Check your machine and available disk before installing.

```sh
cd path/to/ClearHot_Integrated_Workbench
npm ci                                  # downloads Node development packages
npm run build                           # rebuilds HTML + evaluator's Node baseline
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt         # downloads NumPy and PyTorch
export PYTHONPATH="$PWD/training"
python3 -m clearhot_cnn --help
```

`bash scripts/demo.sh some_NEW_output_directory` runs a synthetic demo and refuses an existing path. It intentionally uses **relaxed TEST-ONLY thresholds** to demonstrate approvals. Its default-gate failure is important, not a passing safety result. This integrated build's actual PyTorch training/demo has not been run here; see the test report.

For real pairs, start with `examples/real_pairs_manifest.example.json` and `examples/real_masks.md`. Import to a new directory:

```sh
python3 -m clearhot_cnn import-real --manifest my_local_pairs.json --out data/real-v1
python3 -m clearhot_cnn validate-data data/real-v1
python3 -m clearhot_cnn train --dataset data/real-v1 --registry my_registry --steps 1500
# Copy the ACTUAL checkpoint ID printed by train, then use:
python3 -m clearhot_cnn evaluate --registry my_registry --dataset data/real-v1 --id YOUR_ACTUAL_ID
python3 -m clearhot_cnn status --registry my_registry
```

Read the local validation report before considering explicit approval. Only after all mandatory gates pass, use `approve --registry my_registry --id YOUR_ACTUAL_ID --reviewer YOUR_NAME --confirm-approve YOUR_ACTUAL_ID`. Failed gates block approval; never alter thresholds just to make a result pass. `reject` and `rollback` are separate commands; see `--help`. Repeat training with newly curated data and evaluate against the frozen baseline and active model. **Current trainer starts a new network each run; it does not resume the active weights.** Final-test access is logged but can be invoked repeatedly, so preserving a genuinely untouched holdout remains a human/protocol responsibility.

A real supervised target cannot be assumed from a neighboring frame, a sharpened image, or the viewer's ROI ratings. An attestation and distinct hashes do not prove truth, alignment or independence. Mask input is supported by code, but there is **no built-in pixel-mask drawing tool**. Missing mask or stripe-free evidence causes the corresponding gates to fail, not pass. Reproducible real-data end-to-end training remains unverified.

For a cache after approval (or deliberately using an explicitly marked unapproved candidate), run `python3 -m clearhot_cnn infer --help`. It estimates disk, requires consent, refuses a nonempty output directory, and writes a new cache. Attach its `manifest.json` and `frames.u16` under **Optional learning** after selecting the same source/decoder. The viewer checks the full source SHA-256 and cache hash, frame identity and geometry. Approval information is locally supplied metadata, not a cryptographic independent audit. Cache/model/dataset/report/session files can contain sensitive information; delete or share only deliberately.

## Testing and reproduction

- `npm ci && npm run build && npm run typecheck && npm test` (Node test for an actual generated model cache will be skipped until Python E2E fixtures exist).
- With NumPy installed: `PYTHONPATH=training python3 tests/test_mask_import.py`, `tests/test_gates_independent.py`, `tests/test_registry_independent.py`. Registry unit tests use a stub report formatter and fake bytes, not PyTorch.
- To run browser tests, install Playwright and Chromium separately, then run `node tests/integrated-browser.cjs`, `node tests/cache-browser.cjs`, and the three inherited browser checks. Playwright/Chromium installation downloads software and is not included in the Node lockfile.
- Full optional Python training tests: with the pinned supported stack, `bash scripts/run_all_tests.sh`. This may take significant compute and disk. They were **not run in the present environment**.

This browser was tested with generated data only. Private data stays local in the observed test flows, but this is not a complete security audit. Keep your original recording read-only and retain the earlier player as a fallback.
