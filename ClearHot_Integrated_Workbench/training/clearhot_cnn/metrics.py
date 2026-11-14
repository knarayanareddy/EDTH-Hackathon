"""Metrics. All values are in the 14-bit COUNT domain (never mixed with 8-bit display values) and are computed from data.
Masks (line / target / ring) exist only for synthetic scenes; metrics needing them return None otherwise."""
from __future__ import annotations

import numpy as np

from . import COUNT_MAX
from .data import MASK_LINE, MASK_RING, MASK_TARGET

DEFINITIONS = {
    "mae_counts": "mean |out - clean| over all pixels/frames (counts)",
    "rmse_counts": "sqrt(mean (out - clean)^2) (counts)",
    "psnr_db": "10*log10(16383^2 / MSE), MAX fixed at the 14-bit full scale (so values are large and only comparable within this table)",
    "ssim": "mean SSIM, 7x7 box window, dynamic range L = (max-min of the clean scene), averaged over frames",
    "stripe_residual_counts": "std over columns of the column-mean of (out - clean): residual/added vertical striping (counts)",
    "line_retention": "[mean(out on thin-line mask) - mean(out on ring)] / [same for clean]; 1.0 = exact, <1 smoothed away, >1 over-enhanced",
    "target_retention": "same as line_retention for small-target masks",
    "ring_bias_ratio": "|mean(out - clean) over ring| / clean contrast: halo/local-background shift",
    "overshoot_p99_ratio": "p99 of positive (out - clean) over feature+ring pixels / clean contrast",
    "clip_increase": "fraction of out pixels at 0 or 16383 minus the same fraction in clean",
    "motion_err_counts": "mean |(out_t - out_{t-1}) - (clean_t - clean_{t-1})|: temporal-difference error (ghosting / smearing of moving targets)",
    "false_correction_ratio": "(no-stripe scenes) MAE(out, clean) / MAE(raw, clean); >1 means the method damaged a stripe-free scene",
}


def _box(a: np.ndarray, k: int) -> np.ndarray:
    pad = k // 2
    p = np.pad(a, ((pad, pad), (pad, pad)), mode="reflect")
    c = np.cumsum(np.cumsum(p, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    H, W = a.shape
    return (c[k:k + H, k:k + W] - c[:H, k:k + W] - c[k:k + H, :W] + c[:H, :W]) / (k * k)


def ssim(x: np.ndarray, y: np.ndarray, L: float) -> float:
    x, y = x.astype(np.float64), y.astype(np.float64)
    c1, c2 = (0.01 * L) ** 2, (0.03 * L) ** 2
    mx, my = _box(x, 7), _box(y, 7)
    vx, vy, cxy = _box(x * x, 7) - mx * mx, _box(y * y, 7) - my * my, _box(x * y, 7) - mx * my
    return float((((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))).mean())


def _contrast(arr, fg, ring):
    return float(arr[fg].mean() - arr[ring].mean())


def scene_metrics(out: np.ndarray, raw: np.ndarray, clean: np.ndarray, masks: np.ndarray, kind: str) -> dict:
    out, raw, clean = out.astype(np.float64), raw.astype(np.float64), clean.astype(np.float64)
    e = out - clean
    mse = float((e ** 2).mean())
    L = float(max(clean.max() - clean.min(), 1.0))
    m = {"mae_counts": float(np.abs(e).mean()), "rmse_counts": mse ** .5,
         "psnr_db": float(10 * np.log10(COUNT_MAX ** 2 / max(mse, 1e-12))),
         "ssim": float(np.mean([ssim(out[t], clean[t], L) for t in range(out.shape[0])])),
         "stripe_residual_counts": float(e.mean(axis=(0, 1)).std()),
         "clip_increase": float(((out <= 0) | (out >= COUNT_MAX)).mean() - ((clean <= 0) | (clean >= COUNT_MAX)).mean()),
         "finite": bool(np.isfinite(out).all())}
    dm = (np.diff(out, axis=0) - np.diff(clean, axis=0)) if out.shape[0] > 1 else np.zeros(1)
    m["motion_err_counts"] = float(np.abs(dm).mean())
    ring = (masks & MASK_RING) > 0
    for name, bit in (("line_retention", MASK_LINE), ("target_retention", MASK_TARGET)):
        fg = (masks & bit) > 0
        m[name] = None
        if fg.any() and ring.any():
            c0 = _contrast(clean, fg, ring)
            if abs(c0) > 1e-6:
                m[name] = float(_contrast(out, fg, ring) / c0)
    anyfg = ((masks & (MASK_LINE | MASK_TARGET)) > 0)
    m["ring_bias_ratio"] = m["overshoot_p99_ratio"] = None
    if anyfg.any() and ring.any():
        c0 = abs(_contrast(clean, anyfg, ring))
        if c0 > 1e-6:
            m["ring_bias_ratio"] = float(abs(e[ring].mean()) / c0)
            m["overshoot_p99_ratio"] = float(np.percentile(np.maximum(e[anyfg | ring], 0), 99) / c0)
    m["false_correction_ratio"] = None
    if kind == "nostripe_flat":
        m["false_correction_ratio"] = float(np.abs(e).mean() / max(np.abs(raw - clean).mean(), 1e-9))
    return m


AGG_KEYS = ["mae_counts", "rmse_counts", "psnr_db", "ssim", "stripe_residual_counts", "motion_err_counts", "clip_increase"]
