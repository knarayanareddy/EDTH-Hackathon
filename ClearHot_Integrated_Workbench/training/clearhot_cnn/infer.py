"""Local, non-destructive inference cache for the ClearHot viewer.

The source recording is only READ. The cache is a new directory containing `frames.u16` (restored 14-bit counts, little-endian
uint16, whole frames, no header) and `manifest.json` that binds the cache to the source by FULL SHA-256, decoder, frame count,
model id/hash and approval state. Nothing is uploaded; the viewer loads both files locally and refuses mismatches."""
from __future__ import annotations

import os
import shutil
import sys
import time
from pathlib import Path

import numpy as np

from . import COUNT_MAX, TOOL_VERSION
from .common import ClearHotError, atomic_write_json, sha256_file, utc_now
from .data import _read_frames
from .model import load_checkpoint, predict_counts
from .train import pick_device

CONTRACT = ("Restored frame = clip(round(counts + 500*residual), 0, 16383) in the SAME 14-bit count domain as the decoded source. "
            "Not a temperature, not radiance, not an 8-bit display image. Rounding to integer counts loses sub-count precision.")


def plan(source, dec: dict, start=0, end=None, out_dir=".") -> dict:
    fb = dec["width"] * dec["height"] * 2
    size = os.path.getsize(source)
    usable = max(0, size - dec["header_bytes"])
    total, rem = usable // fb, usable % fb
    if total < 1:
        raise ClearHotError("source is smaller than one complete frame for the declared decoder; nothing to process (no zero-padding is done)")
    end = total if end is None else end
    if not (0 <= start < end <= total):
        raise ClearHotError(f"frame range [{start},{end}) must satisfy 0 <= start < end <= {total}")
    probe = Path(out_dir)
    while not probe.exists():
        probe = probe.parent
    return {"frame_bytes": fb, "source_frames": total, "remainder_bytes": rem, "start": start, "end": end, "frames_to_cache": end - start,
            "cache_bytes": (end - start) * fb, "free_bytes": shutil.disk_usage(probe).free}


def build_cache(registry, source, out_dir, dec: dict, model="active", allow_unapproved=False, start=0, end=None, yes=False,
                device="cpu", tile=256, log=print, confirm=input) -> dict:
    source = str(source)
    out = Path(out_dir)
    if out.exists() and any(out.iterdir()):
        raise ClearHotError(f"{out} already exists and is not empty; choose a new directory (nothing is overwritten)")
    # ---- resolve model
    if model == "identity":
        raise ClearHotError("identity needs no cache: use the viewer's raw/classical views")
    if model == "active":
        cid, ckpt = registry.active()
        if cid is None:
            raise ClearHotError("no active (human-approved) model. Approve one, or pass --model <id> --allow-unapproved to build a clearly labelled UNAPPROVED cache")
    else:
        cid = model
        ckpt = registry.checkpoint_path(cid)
    rec = registry.record(cid)
    # Explicit model IDs must not masquerade as active just because a record says so.
    active_id, _ = registry.active()
    if rec["status"] == "active" and cid != active_id:
        raise ClearHotError("model claims active status but does not match the verified active pointer")
    if rec["status"] != "active" and not allow_unapproved:
        raise ClearHotError(f"{cid} is '{rec['status']}', not the approved active model. Re-run with --allow-unapproved to create a cache labelled UNAPPROVED")
    device = pick_device(device)
    net, ck = load_checkpoint(ckpt, expected_sha256=rec["checkpoint_sha256"], device=device)
    # ---- disk plan + consent
    p = plan(source, dec, start, end, out_dir)
    log(f"Source frames: {p['source_frames']} (remainder {p['remainder_bytes']} bytes{' — format suspect' if p['remainder_bytes'] else ''}); "
        f"will process frames [{p['start']},{p['end']}).")
    log(f"Predicted cache size: {p['cache_bytes'] / 1e6:.1f} MB; free disk: {p['free_bytes'] / 1e6:.0f} MB. Output: {out}")
    if p["cache_bytes"] * 1.05 > p["free_bytes"]:
        raise ClearHotError("not enough free disk space for the predicted cache")
    if not yes:
        if not sys.stdin or not sys.stdin.isatty():
            raise ClearHotError("refusing to write a large cache without consent: pass --yes (non-interactive) or run interactively")
        if confirm("Write this cache? [y/N] ").strip().lower() not in ("y", "yes"):
            raise ClearHotError("cancelled by user; nothing written")
    log("Hashing source (full SHA-256, streaming)...")
    src_sha = sha256_file(source)
    out.mkdir(parents=True, exist_ok=True)
    fpath = out / "frames.u16"
    t0 = time.time()
    try:
        with open(fpath, "wb") as f:
            for i in range(p["start"], p["end"]):
                fr = _read_frames(source, dec, [i])[0]
                res = predict_counts(net, fr, tile=tile, device=device)
                f.write(np.clip(np.rint(res), 0, COUNT_MAX).astype("<u2").tobytes())
                if (i - p["start"]) % 20 == 0:
                    log(f"  frame {i}/{p['end'] - 1}")
    except BaseException:
        for q in out.iterdir():
            q.unlink()
        out.rmdir()
        raise
    secs = time.time() - t0
    man = {"schema": "clearhot-cnn-cache-v1", "tool_version": TOOL_VERSION, "created": utc_now(),
           "source": {"name": os.path.basename(source), "size_bytes": os.path.getsize(source), "sha256": src_sha, "sha256_kind": "full-file streaming SHA-256"},
           "decoder": {"width": dec["width"], "height": dec["height"], "headerBytes": dec["header_bytes"], "shift": dec["shift"],
                       "littleEndian": dec["little_endian"], "bits": 14},
           "frames": {"sourceTotal": p["source_frames"], "remainderBytes": p["remainder_bytes"], "cachedFirst": p["start"], "cachedCount": p["frames_to_cache"]},
           "cache": {"file": "frames.u16", "dtype": "uint16-le", "frameBytes": p["frame_bytes"], "sizeBytes": fpath.stat().st_size,
                     "sha256": sha256_file(fpath), "domain": "14-bit counts restored by the CNN (integer-rounded, clipped 0..16383)"},
           "model": {"id": cid, "status": rec["status"], "approved": rec["status"] == "active", "label": rec["label"],
                     "checkpointSha256": rec["checkpoint_sha256"], "weightsSha256": rec["weights_sha256"], "archSha256": rec["arch_sha256"],
                     "dataDomain": rec["data_domain"], "simulatedDemo": rec["simulated_demo"], "approval": rec["approval"],
                     "validationPassed": bool(rec["validation"] and rec["validation"]["all_mandatory_passed"])},
           "inference": {"tile": tile, "halo": 8, "device": device, "contract": CONTRACT, "seconds": secs, "ms_per_frame_measured": secs * 1000 / p["frames_to_cache"],
                         "note": "measured on this machine for this run only"},
           "warnings": (["UNAPPROVED model: not human-approved. Do not treat as validated."] if rec["status"] != "active" else []) +
                       (["SYNTHETIC-trained model: no evidence of quality on real footage."] if rec["data_domain"] == "SYNTHETIC" else [])}
    atomic_write_json(out / "manifest.json", man)
    log(f"Wrote {fpath} and manifest.json in {secs:.1f}s")
    return man
