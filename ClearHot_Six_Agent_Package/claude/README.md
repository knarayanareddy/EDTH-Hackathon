# ClearHot Lab ×3

Three independent instances of the ClearHot thermal pipeline (from `knarayanareddy/EDTH-Hackathon/thermalimagehack`), each adding a *different* set of techniques for

1. reducing parallel-line / static artefacts,
2. digital picture enhancement,
3. CNN training exploration,

plus a side-by-side compare view and a held-out **synthetic** benchmark to see which methodology works best.

| Instance | Line suppression | Enhancement | CNN |
|---|---|---|---|
| **A** robust spatial | iterated robust local-median offsets, edge/step/segment gating | AGC → CLAHE → unsharp | DnCNN-lite 2-D residual |
| **B** multi-frame | same estimator on a 12-frame mean, motion-gated per-pixel FPN | temporal denoise → plateau HE → guided-filter detail | 1-D profile CNN |
| **C** spectral | spectral high-pass + periodic-peak notch on line profile | bilateral → AGC → 3-band detail + base compression | directional stripe-kernel CNN |

The original pipeline remains available inside each instance (Line method → *Original ClearHot heuristic*) and as the "Original" column in Compare.

## Run

```bash
npm install
npm run dev -- --host 127.0.0.1
npm run build            # dist/index.html (single file)
```

## Tests (generated data only)

```bash
npx esbuild tests/pipeline-tests.ts --bundle --platform=node --format=esm --outfile=.tmp/tests.mjs --external:@tensorflow/tfjs && node .tmp/tests.mjs
npx esbuild tests/bench-node.ts     --bundle --platform=node --format=esm --outfile=.tmp/bench.mjs --external:@tensorflow/tfjs && node .tmp/bench.mjs
npx esbuild tests/train-node.ts     --bundle --platform=node --format=esm --outfile=.tmp/train.mjs --external:@tensorflow/tfjs && SA=150 SB=200 SC=120 BA=4 BB=4 BC=4 node .tmp/train.mjs   # slow on CPU
```

## Honesty notes

* Synthetic frames and all scores derived from them are **simulated**. The organiser's file was not available; nothing claims real-data accuracy, 25 fps or FPGA readiness.
* CNNs exist only after you train them (in-browser TensorFlow.js, simulated data). `training/train_clearhot_cnn.py` (PyTorch, CPU/MPS/CUDA) has **not been executed**.
* Input data is only read, never modified. Everything runs locally.
