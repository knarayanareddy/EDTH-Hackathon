#!/usr/bin/env python3
"""
ClearHot CNN training prototype (PyTorch) — mirrors the three architectures explored in the web lab.

STATUS: **NOT EXECUTED** in the environment where this file was written (no PyTorch available there).
It is a reviewed-by-reading starting point, not a tested tool. Run the smoke test first:

    python train_clearhot_cnn.py --variant C --steps 30 --smoke

Data policy (important)
  * Default data is SIMULATED: random smooth scenes + synthetic stripes/noise. A model trained this way is a
    software demonstration only; it is NOT validated for real sensor fixed-pattern noise.
  * To use real *trusted clean* frames, pass --clean-dir DIR. Layout: DIR/<recording_name>/*.npy (uint16 640x512,
    14-bit values). Train/val/test are split BY RECORDING (folder), never by neighbouring frames or patches.
    Check the challenge rules before training on challenge data. Never train on the evaluation set.
  * Consecutive video frames are NOT clean targets (fixed pattern is correlated across frames, scenes move).

Variants  A: DnCNN-lite (2-D, MSE)   B: 1-D profile CNN (Huber)   C: directional stripe-kernel CNN (L1 + gradient)
Device    CUDA if present, else Apple-silicon MPS, else CPU (override with --device).
"""
import argparse, glob, os, time, json
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

S = 100.0  # ADU normalisation scale, identical to the web lab


# ------------------------------------------------------------------ simulated scenes
def value_noise(h, w, cell, rng):
    gh, gw = h // cell + 3, w // cell + 3
    g = rng.uniform(-1, 1, (gh, gw)).astype(np.float32)
    t = torch.from_numpy(g)[None, None]
    up = F.interpolate(t, scale_factor=cell, mode="bicubic", align_corners=False)[0, 0].numpy()
    return up[:h, :w]


def make_scene(seed, h=256, w=256):
    rng = np.random.default_rng(seed)
    horizon = int(h * rng.uniform(0.28, 0.46))
    n1, n2, n3 = value_noise(h, w, 36, rng), value_noise(h, w, 9, rng), value_noise(h, w, 4, rng)
    sky = 7000 + rng.uniform(0, 150) + 40 * n1 + 6 * n3
    gnd = 7250 + rng.uniform(0, 200) + 90 * n1 + 45 * n2 + 14 * n3
    img = np.where(np.arange(h)[:, None] < horizon, sky, gnd).astype(np.float32)
    for _ in range(rng.integers(1, 4)):  # buildings: real vertical/horizontal edges
        bw, bh = int(w * rng.uniform(0.06, 0.14)), int(h * rng.uniform(0.08, 0.23))
        bx = int(rng.uniform(0, w - bw)); img[max(0, horizon - bh):horizon + 4, bx:bx + bw] += 150
    return img


# ------------------------------------------------------------------ corruption + normalisation
def corrupt(clean, gen):
    """clean: [B,1,H,W] float ADU. Returns corrupted, stripe components."""
    B, _, H, W = clean.shape
    dev = clean.device
    amp_v = torch.rand(B, 1, 1, 1, device=dev, generator=gen) * 55 * (torch.rand(B, 1, 1, 1, device=dev, generator=gen) < 0.7)
    amp_h = torch.rand(B, 1, 1, 1, device=dev, generator=gen) * 55 * (torch.rand(B, 1, 1, 1, device=dev, generator=gen) < 0.5)
    amp_v = torch.where((amp_v + amp_h) == 0, torch.full_like(amp_v, 20.0), amp_v)
    col = torch.randn(B, 1, 1, W, device=dev, generator=gen) * amp_v
    row = torch.randn(B, 1, H, 1, device=dev, generator=gen) * amp_h
    sigma = 3 + torch.rand(B, 1, 1, 1, device=dev, generator=gen) * 16
    noise = torch.randn_like(clean) * sigma
    return clean + col + row + noise, col, row


def norm_in(x):
    med = x.flatten(1).median(dim=1).values.view(-1, 1, 1, 1)
    return ((x - med) / S).clamp(-6, 6)


def profile_feature(x, along_h, R=8):
    """Robust residual profile used by variant B. along_h=True -> column profile (length W)."""
    if not along_h:
        x = x.transpose(2, 3)
    B, _, H, W = x.shape
    k = torch.ones(1, 1, 1, 2 * R + 1, device=x.device); k[..., R] = 0; k = k / (2 * R)
    ref = F.conv2d(F.pad(x, (R, R, 0, 0), mode="replicate"), k)
    e = (x - ref).clamp(-150, 150)
    return e.median(dim=2).values  # [B,1,W]


# ------------------------------------------------------------------ models
class DnCNNLite(nn.Module):
    def __init__(self):
        super().__init__()
        L = [nn.Conv2d(1, 8, 3, padding=1), nn.ReLU()]
        for _ in range(3): L += [nn.Conv2d(8, 8, 3, padding=1), nn.ReLU()]
        L += [nn.Conv2d(8, 1, 3, padding=1)]
        self.net = nn.Sequential(*L)
    def forward(self, x): return self.net(x)


class Profile1D(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(nn.Conv1d(1, 16, 17, padding=8), nn.ReLU(), nn.Conv1d(16, 16, 17, padding=8), nn.ReLU(),
                                 nn.Conv1d(16, 16, 17, padding=8), nn.ReLU(), nn.Conv1d(16, 1, 1))
    def forward(self, x): return self.net(x)


class Directional(nn.Module):
    def __init__(self):
        super().__init__()
        c = lambda i, o, k: nn.Conv2d(i, o, k, padding=(k[0] // 2, k[1] // 2))
        self.a = nn.Sequential(c(1, 8, (15, 1)), nn.ReLU(), c(8, 8, (15, 1)), nn.ReLU(), c(8, 8, (1, 7)), nn.ReLU(), c(8, 1, (1, 1)))
        self.b = nn.Sequential(c(1, 8, (1, 15)), nn.ReLU(), c(8, 8, (1, 15)), nn.ReLU(), c(8, 8, (7, 1)), nn.ReLU(), c(8, 1, (1, 1)))
        self.n = nn.Sequential(c(1, 4, (3, 3)), nn.ReLU(), c(4, 1, (1, 1)))
    def forward(self, x): return self.a(x) + self.b(x) + self.n(x)


def grad_l1(pred, tgt):
    d = tgt - pred
    return d.abs().mean() + 0.5 * ((d[..., :, 1:] - d[..., :, :-1]).abs().mean() + (d[..., 1:, :] - d[..., :-1, :]).abs().mean())


MODELS = {"A": (DnCNNLite, nn.MSELoss()), "B": (Profile1D, nn.HuberLoss(delta=0.3)), "C": (Directional, grad_l1)}


# ------------------------------------------------------------------ data
def load_pools(args):
    if args.clean_dir:
        recs = sorted(d for d in glob.glob(os.path.join(args.clean_dir, "*")) if os.path.isdir(d))
        assert len(recs) >= 3, "need >=3 recordings to split train/val/test by recording"
        frames = [[np.load(f).astype(np.float32).reshape(512, 640) for f in sorted(glob.glob(os.path.join(r, "*.npy")))[:50]] for r in recs]
        n = len(recs); tr, va, te = frames[: n - 2], frames[n - 2: n - 1], frames[n - 1:]
        flat = lambda L: [f for r in L for f in r]
        return flat(tr), flat(va), flat(te)
    return ([make_scene(1000 + i) for i in range(32)], [make_scene(9000 + i) for i in range(8)], [make_scene(50000 + i) for i in range(8)])


def sample_batch(pool, B, P, device, gen_np, gen_t, variant):
    size = 256 if variant == "B" else P
    xs = []
    for _ in range(B):
        sc = pool[gen_np.integers(len(pool))]
        h, w = sc.shape
        y0, x0 = gen_np.integers(0, h - size + 1), gen_np.integers(0, w - size + 1)
        xs.append(sc[y0:y0 + size, x0:x0 + size])
    clean = torch.from_numpy(np.stack(xs))[:, None].to(device)
    corr, col, row = corrupt(clean, gen_t)
    if variant == "B":
        along_h = bool(gen_np.integers(2))
        feat = profile_feature(corr, along_h) / S
        off = (col if along_h else row.transpose(2, 3)).squeeze(2)  # [B,1,L]
        return feat, (off - off.mean(dim=-1, keepdim=True)) / S
    return norm_in(corr), (corr - clean) / S


def psnr(a, b, lo, hi):
    a, b = a.clamp(lo, hi), b.clamp(lo, hi)
    mse = ((a - b) / (hi - lo) * 255).pow(2).mean().clamp_min(1e-6)
    return float(10 * torch.log10(255 ** 2 / mse))


@torch.no_grad()
def evaluate(model, variant, pool, device, gen_np, gen_t):
    model.eval()
    x, y = sample_batch(pool, 16, 128, device, gen_np, gen_t, variant)
    loss = float(F.mse_loss(model(x), y))
    model.train()
    return loss, float(F.mse_loss(torch.zeros_like(y), y))  # (model, identity)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", choices=list(MODELS), required=True)
    ap.add_argument("--steps", type=int, default=2000)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--device", default=None)
    ap.add_argument("--clean-dir", default=None)
    ap.add_argument("--out", default="clearhot_cnn_%s.pt")
    ap.add_argument("--smoke", action="store_true", help="tiny run to check the script executes")
    args = ap.parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    torch.manual_seed(args.seed); gen_np = np.random.default_rng(args.seed)
    gen_t = torch.Generator(device=device if device != "mps" else "cpu").manual_seed(args.seed)
    if device == "mps": gen_t = None  # MPS generators are limited; fall back to the global seeded RNG
    train, val, test = load_pools(args)
    cls, loss_fn = MODELS[args.variant]
    model = cls().to(device); opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    print(f"variant {args.variant} · {sum(p.numel() for p in model.parameters()):,} params · device {device} · "
          f"train/val/test scenes {len(train)}/{len(val)}/{len(test)} · data={'real clean frames' if args.clean_dir else 'SIMULATED'}")
    t0 = time.time()
    for step in range(1, args.steps + 1):
        x, y = sample_batch(train, args.batch, 64, device, gen_np, gen_t, args.variant)
        loss = loss_fn(model(x), y)
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 50 == 0 or step == args.steps:
            v, ident = evaluate(model, args.variant, val, device, gen_np, gen_t)
            print(f"step {step:5d} train {loss.item():.5f} | val mse {v:.5f} (identity {ident:.5f}) | {time.time() - t0:.0f}s")
    # the test pool is evaluated ONCE, after training, and never used for any choice
    t, ident = evaluate(model, args.variant, test, device, gen_np, gen_t)
    print(json.dumps({"test_mse": t, "identity_mse": ident, "improved": t < ident, "note": "simulated unless --clean-dir was used"}))
    torch.save({"variant": args.variant, "state": model.state_dict()}, args.out % args.variant)


if __name__ == "__main__":
    main()
