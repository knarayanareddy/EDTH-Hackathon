# ClearHot CNN training prototype (PyTorch)

`train_clearhot_cnn.py` mirrors the three CNNs of the web lab (A: DnCNN-lite, B: 1-D profile CNN, C: directional stripe-kernel CNN).

**Status: not executed in the environment where it was written (no PyTorch available).** Run the smoke test first.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install torch numpy                       # Apple silicon: the default wheel includes MPS
python training/train_clearhot_cnn.py --variant C --steps 30 --smoke
python training/train_clearhot_cnn.py --variant C --steps 2000 --batch 16   # simulated data
python training/train_clearhot_cnn.py --variant C --clean-dir /path/to/clean_frames   # real trusted clean frames, split by recording
```

* Default data is SIMULATED; a model trained on it is not validated for real sensor noise.
* `--clean-dir` expects `DIR/<recording>/*.npy` (uint16, 512x640, 14-bit). Needs >= 3 recordings; train/val/test are split by recording.
* The test pool is evaluated once at the end. Do not tune on it. Check the challenge's data-use rules before training on its data.
