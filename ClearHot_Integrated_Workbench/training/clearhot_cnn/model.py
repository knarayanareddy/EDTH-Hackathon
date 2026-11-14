"""Small trainable residual CNN for 14-bit thermal COUNT-domain restoration.

WHAT IT PREDICTS (exact contract)
  input : one uint16 frame of 14-bit counts, shape [H,W] (decoded exactly as the viewer decodes: shift, mask 0x3FFF).
  features (2 channels, computed on the FULL frame before any tiling):
      ch0 = (counts - 7000) / 500                       (fixed normalisation constants, saved in the checkpoint)
      ch1 = COL_GAIN * high-pass(column-mean profile) / 500, broadcast down each column  (context for stripe estimation)
  network: 5 x Conv3x3 (16 channels, ReLU between) predicting a residual in normalised units; last conv is zero-initialised so
           an untrained model is exactly the identity.
  output: counts_out = clip(counts + 500 * residual, 0, 16383) as float32 counts. SAME DOMAIN AS THE INPUT.
          It is NOT a temperature, NOT radiance, NOT an 8-bit display image and NOT an AGC/tone-map. The viewer applies the same fixed
          window to raw, Argos-2-stage-1 and CNN counts when it shows a common-tone comparison.
  insertion point: single-frame count-domain restoration BEFORE any display transform. It is not applied inside Argos 2.
"""
from __future__ import annotations

import io

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from . import COUNT_MAX
from .common import ClearHotError, json_sha256, sha256_bytes

NORM_CENTER = 7000.0
NORM_SCALE = 500.0
COL_GAIN = 8.0
DEFAULT_ARCH = {"name": "ClearHotResNet-v1", "in_channels": 2, "channels": 16, "depth": 5, "kernel": 3,
                "norm_center": NORM_CENTER, "norm_scale": NORM_SCALE, "col_gain": COL_GAIN, "col_smooth_window": 9}


def features(counts: torch.Tensor, arch: dict | None = None) -> torch.Tensor:
    """counts [N,H,W] float -> [N,2,H,W]."""
    a = arch or DEFAULT_ARCH
    x = (counts - a["norm_center"]) / a["norm_scale"]
    colmean = x.mean(dim=1)  # [N,W]
    k = a["col_smooth_window"]
    pad = k // 2
    sm = F.avg_pool1d(F.pad(colmean[:, None, :], (pad, pad), mode="replicate"), k, stride=1)[:, 0, :]
    hp = (colmean - sm) * a["col_gain"]
    return torch.stack([x, hp[:, None, :].expand_as(x)], dim=1)


class ClearHotNet(nn.Module):
    def __init__(self, arch: dict | None = None):
        super().__init__()
        self.arch = dict(arch or DEFAULT_ARCH)
        c, d, k = self.arch["channels"], self.arch["depth"], self.arch["kernel"]
        layers = [nn.Conv2d(self.arch["in_channels"], c, k, padding=k // 2), nn.ReLU()]
        for _ in range(d - 2):
            layers += [nn.Conv2d(c, c, k, padding=k // 2), nn.ReLU()]
        last = nn.Conv2d(c, 1, k, padding=k // 2)
        nn.init.zeros_(last.weight)
        nn.init.zeros_(last.bias)
        layers.append(last)
        self.body = nn.Sequential(*layers)

    def forward(self, feats: torch.Tensor) -> torch.Tensor:
        """feats [N,2,H,W] -> restored normalised frame [N,H,W]."""
        return feats[:, 0] + self.body(feats)[:, 0]


def arch_sha256(arch: dict) -> str:
    return json_sha256(arch)


def weights_sha256(model: nn.Module) -> str:
    parts = []
    for k, v in sorted(model.state_dict().items()):
        parts.append(k.encode() + str(tuple(v.shape)).encode() + v.detach().cpu().contiguous().numpy().tobytes())
    return sha256_bytes(b"".join(parts))


def check_finite(model: nn.Module) -> None:
    for k, v in model.state_dict().items():
        if not torch.isfinite(v).all():
            raise ClearHotError(f"non-finite weights in {k}")


@torch.no_grad()
def predict_counts(model, frame: np.ndarray, tile: int = 256, halo: int = 8, device: str = "cpu") -> np.ndarray:
    """Restore one [H,W] uint16 frame -> float32 counts in [0,16383]. model=None is the explicit identity / no-CNN option.
    Features are computed on the whole frame, then the convolution runs tile by tile with a halo >= receptive-field radius."""
    f32 = np.asarray(frame, dtype=np.float32)
    if model is None:
        return f32.copy()
    if f32.ndim != 2:
        raise ClearHotError("frame must be [H,W]")
    H, W = f32.shape
    model.eval()
    a = model.arch
    if halo < a["depth"]:
        raise ClearHotError("halo must be >= network depth (receptive-field radius)")
    ft = features(torch.from_numpy(f32)[None], a).to(device)
    out = np.empty((H, W), np.float32)
    for y0 in range(0, H, tile):
        for x0 in range(0, W, tile):
            y1, x1 = min(H, y0 + tile), min(W, x0 + tile)
            ya, xa, yb, xb = max(0, y0 - halo), max(0, x0 - halo), min(H, y1 + halo), min(W, x1 + halo)
            r = model.body(ft[:, :, ya:yb, xa:xb])[0, 0] * a["norm_scale"]
            res = r[y0 - ya:y0 - ya + (y1 - y0), x0 - xa:x0 - xa + (x1 - x0)].cpu().numpy()
            out[y0:y1, x0:x1] = f32[y0:y1, x0:x1] + res
    if not np.isfinite(out).all():
        raise ClearHotError("model produced non-finite output; refusing to use it")
    return np.clip(out, 0, COUNT_MAX).astype(np.float32)


def load_checkpoint(path, expected_sha256: str | None = None, device: str = "cpu"):
    """Load weights (weights_only: no pickled code). Optionally verify the immutable file hash first."""
    from .common import sha256_file

    if expected_sha256 is not None and sha256_file(path) != expected_sha256:
        raise ClearHotError(f"checkpoint {path} does not match its registered SHA-256; refusing to load")
    ck = torch.load(path, map_location=device, weights_only=True)
    if ck.get("format") != "clearhot-ckpt-v1":
        raise ClearHotError("not a clearhot-ckpt-v1 checkpoint")
    model = ClearHotNet(ck["arch"]).to(device)
    model.load_state_dict(ck["state_dict"])
    check_finite(model)
    if weights_sha256(model) != ck["weights_sha256"]:
        raise ClearHotError("weights hash inside checkpoint does not match loaded weights")
    model.eval()
    return model, ck


def serialize(obj) -> bytes:
    buf = io.BytesIO()
    torch.save(obj, buf)
    return buf.getvalue()
