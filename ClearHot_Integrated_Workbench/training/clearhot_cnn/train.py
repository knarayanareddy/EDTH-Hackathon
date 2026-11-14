"""Real CNN training (PyTorch autograd + Adam). Uses ONLY the train split for gradient steps and the val split for monitoring.
The reserved final test split is never loaded here."""
from __future__ import annotations

import time

import numpy as np
import torch

from .common import ClearHotError, code_sha256, environment_info, utc_now
from .data import load_split, verify_dataset_files
from .model import ClearHotNet, DEFAULT_ARCH, NORM_CENTER, NORM_SCALE, arch_sha256, check_finite, features, predict_counts, serialize, weights_sha256


def pick_device(name: str) -> str:
    if name == "auto":
        return "mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu"
    if name == "mps" and not (getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()):
        raise ClearHotError("device 'mps' requested but not available on this machine (this is reported, not silently replaced)")
    return name


def _val_mae(model, val, device) -> float:
    errs = []
    for s in range(val["noisy"].shape[0]):
        for t in range(0, val["noisy"].shape[1], 2):
            out = predict_counts(model, val["noisy"][s, t], device=device)
            errs.append(float(np.abs(out - val["clean"][s, t]).mean()))
    return float(np.mean(errs))


def train(dataset_dir, steps=1500, seed=0, batch=16, patch=32, lr=3e-3, device="cpu", arch=None, demo_fault=None, log=print,
          eval_every=250, threads=1, feature_focus=0.5) -> dict:
    """Returns {'bytes': checkpoint bytes, 'info': {...}}. Fails loudly on non-finite loss."""
    device = pick_device(device)
    manifest = verify_dataset_files(dataset_dir)  # also re-validates leakage rules
    torch.set_num_threads(max(1, int(threads)))
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    tr, va = load_split(dataset_dir, "train"), load_split(dataset_dir, "val")
    arch = dict(arch or DEFAULT_ARCH)
    noisy = torch.from_numpy(tr["noisy"].reshape(-1, *tr["noisy"].shape[2:]).astype(np.float32))
    clean = torch.from_numpy(tr["clean"].reshape(-1, *tr["clean"].shape[2:]).astype(np.float32))
    if demo_fault == "bias":  # TEST/DEMO ONLY: deliberately corrupted targets to demonstrate gate rejection
        clean = clean + 150.0
    elif demo_fault is not None:
        raise ClearHotError(f"unknown demo_fault {demo_fault}")
    # hard-example sampling (only when the dataset has masks, i.e. synthetic): a fraction of patches is centred on known feature pixels
    fm = tr["masks"].reshape(-1, *tr["masks"].shape[2:]) & 3
    focus_pts = np.argwhere(fm > 0) if (manifest.get("masks_available") and feature_focus > 0) else np.zeros((0, 3), int)
    feats = features(noisy, arch).to(device)
    tgt = ((clean - arch["norm_center"]) / arch["norm_scale"]).to(device)
    N, _, H, W = feats.shape
    p = min(patch, H, W)
    model = ClearHotNet(arch).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, steps))
    history, val_history = [], []
    w0 = weights_sha256(model)
    t0 = time.time()
    for step in range(1, steps + 1):
        idx = rng.integers(0, N, batch)
        ys, xs = rng.integers(0, H - p + 1, batch), rng.integers(0, W - p + 1, batch)
        if len(focus_pts):
            for b in range(batch):
                if rng.random() < feature_focus:
                    fi, fy, fx = focus_pts[rng.integers(0, len(focus_pts))]
                    idx[b] = fi
                    ys[b], xs[b] = min(max(fy - p // 2 + int(rng.integers(-p // 4, p // 4 + 1)), 0), H - p), min(max(fx - p // 2 + int(rng.integers(-p // 4, p // 4 + 1)), 0), W - p)
        fb = torch.stack([feats[i, :, y:y + p, x:x + p] for i, y, x in zip(idx, ys, xs)])
        tb = torch.stack([tgt[i, y:y + p, x:x + p] for i, y, x in zip(idx, ys, xs)])
        if rng.random() < .5:  # horizontal flip (commutes with the column features)
            fb, tb = fb.flip(-1), tb.flip(-1)
        pred = model(fb)
        loss = torch.sqrt((pred - tb) ** 2 + 1e-6).mean()  # Charbonnier
        if not torch.isfinite(loss):
            raise ClearHotError(f"non-finite training loss at step {step}; training aborted, no checkpoint written")
        opt.zero_grad()
        loss.backward()
        opt.step()
        sched.step()
        if step % 25 == 0 or step == 1 or step == steps:
            history.append({"step": step, "train_loss_norm": float(loss)})
        if step % eval_every == 0 or step == steps:
            vm = _val_mae(model.to("cpu") if device != "cpu" else model, va, "cpu" if device != "cpu" else device)
            model.to(device)
            val_history.append({"step": step, "val_mae_counts": vm})
            log(f"  step {step:5d}/{steps}  train_loss(norm) {float(loss):.5f}  val MAE {vm:.3f} counts  [{time.time() - t0:.0f}s]")
    check_finite(model)
    w1 = weights_sha256(model)
    if w1 == w0:
        raise ClearHotError("weights did not change during training (no update happened)")
    model = model.to("cpu")
    meta = {"format": "clearhot-ckpt-v1", "arch": arch, "arch_sha256": arch_sha256(arch), "weights_sha256": weights_sha256(model),
            "initial_weights_sha256": w0, "steps": steps, "history": history, "val_history": val_history,
            "config": {"steps": steps, "batch": batch, "patch": p, "lr": lr, "seed": seed, "optimizer": "Adam", "loss": "Charbonnier(eps=1e-3) in normalised units",
                       "device": device, "threads": threads, "demo_fault": demo_fault, "feature_focus": float(feature_focus if len(focus_pts) else 0.0)},
            "dataset": {"version": manifest["dataset_version"], "domain": manifest["domain"], "manifest_sha256": manifest["manifest_sha256"],
                        "train_sha256": manifest["splits"]["train"]["sha256"], "val_sha256": manifest["splits"]["val"]["sha256"]},
            "code_sha256": code_sha256(), "env": environment_info(), "created": utc_now(), "train_seconds": time.time() - t0}
    ck = dict(meta, state_dict={k: v.detach().cpu() for k, v in model.state_dict().items()},
              optimizer_state=opt.state_dict(), scheduler_state=sched.state_dict())
    return {"bytes": serialize(ck), "info": meta}
