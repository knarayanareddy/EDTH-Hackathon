"""Synthetic known-clean generator, dataset manifests, leakage validation, real-pair import.

All synthetic data is LABELLED synthetic. A preference, an ROI, an adjacent noisy frame, a blurred
frame or a model prediction is never accepted as a clean target.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np

from . import COUNT_MAX
from .common import ClearHotError, atomic_write_json, json_sha256, read_json, sha256_bytes, sha256_file, utc_now

GENERATOR_VERSION = "synth-1.0"
KINDS = ["stripe_blob", "wire_vertical", "wire_horizontal", "texture", "nostripe_flat",
         "alt_stripes_strong", "small_targets", "bridge_motion"]
CHALLENGES = {"nostripe_flat": "no-stripe false correction", "wire_vertical": "true full-height vertical line",
              "wire_horizontal": "true full-width horizontal line", "alt_stripes_strong": "alternating strong stripes",
              "small_targets": "small targets", "bridge_motion": "motion/occlusion + similar-brightness bar",
              "texture": "texture", "stripe_blob": "fixed-pattern stripes + blob"}
MASK_LINE, MASK_TARGET, MASK_RING = 1, 2, 4
ALLOWED_TARGET_KINDS = {"synthetic_known_clean", "trusted_external_reference"}
REJECTED_TARGET_KINDS = {"adjacent_frame", "adjacent_noisy_frame", "blurred", "blurred_input", "model_prediction",
                         "classical_output", "unlabeled", "unknown", "preference", "roi_label", "label_only"}
SPLITS = ("train", "val", "test")
SPLIT_FILES = {"train": "train.npz", "val": "val.npz", "test": "final_test.npz"}


def _dilate(m: np.ndarray, r: int) -> np.ndarray:
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def make_scene(kind: str, seed: int, h: int = 64, w: int = 64, t: int = 8):
    """Deterministic scene. Returns clean float32 [T,H,W], noisy uint16 [T,H,W], masks uint8 [T,H,W], meta."""
    if kind not in KINDS:
        raise ClearHotError(f"unknown synthetic kind {kind}")
    rng = np.random.default_rng([KINDS.index(kind), int(seed)])
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = 6800 + rng.uniform(-300, 300) + (300 + 100 * rng.random()) * yy / h
    for _ in range(2):  # smooth background undulation
        cx, cy, s = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(w * .15, w * .35)
        base = base + rng.uniform(-120, 120) * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * s * s))
    clean = np.repeat(base[None], t, 0).astype(np.float32)
    masks = np.zeros((t, h, w), np.uint8)
    stripe_amp, row_amp, temporal_sigma, fpn = 30.0, 6.0, 11.0, 5.0
    if kind == "stripe_blob":
        cx, cy = rng.uniform(.3 * w, .7 * w), rng.uniform(.3 * h, .7 * h)
        for k in range(t):
            blob = 220 * np.exp(-((xx - cx - 0.5 * k) ** 2 + (yy - cy) ** 2) / (2 * 4.0 ** 2))
            clean[k] += blob
            masks[k][blob > 110] |= MASK_TARGET
    elif kind == "wire_vertical":
        x0 = int(rng.integers(int(.2 * w), int(.8 * w)))
        clean[:, :, x0] += 200
        masks[:, :, x0] |= MASK_LINE
    elif kind == "wire_horizontal":
        y0 = int(rng.integers(int(.2 * h), int(.8 * h)))
        clean[:, y0, :] += 150
        masks[:, y0, :] |= MASK_LINE
    elif kind == "texture":
        tex = rng.normal(0, 1, (h, w)).astype(np.float32)
        k5 = np.ones(5, np.float32) / 5
        sm = lambda v: np.convolve(v, k5, "same")  # noqa: E731
        tex = np.apply_along_axis(sm, 0, np.apply_along_axis(sm, 1, tex))
        clean += (tex / (tex.std() + 1e-6) * 45)[None]
    elif kind == "nostripe_flat":
        stripe_amp, row_amp, fpn = 0.0, 0.0, 0.0
        cx, cy = rng.uniform(.3 * w, .7 * w), rng.uniform(.3 * h, .7 * h)
        clean += (120 * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * 8.0 ** 2)))[None]
    elif kind == "alt_stripes_strong":
        stripe_amp = 55.0
        clean += (35 * np.exp(-((xx - w / 2) ** 2 + (yy - h / 2) ** 2) / (2 * 9.0 ** 2)))[None]
    elif kind == "small_targets":
        for _ in range(3):
            cx, cy = rng.uniform(6, w - 6), rng.uniform(6, h - 6)
            blob = 260 * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * 1.4 ** 2))
            clean += blob[None]
            masks[:, blob > 130] |= MASK_TARGET
    elif kind == "bridge_motion":
        y0 = int(rng.integers(int(.35 * h), int(.6 * h)))
        clean[:, y0:y0 + 3, :] += 200
        masks[:, y0:y0 + 3, :] |= MASK_LINE
        cy = rng.uniform(.2 * h, .3 * h)
        for k in range(t):
            blob = 210 * np.exp(-((xx - (6 + 3 * k)) ** 2 + (yy - cy) ** 2) / (2 * 3.0 ** 2))
            clean[k] += blob
            masks[k][blob > 105] |= MASK_TARGET
    for k in range(t):  # ring = local background around features (retention / halo metrics)
        fg = (masks[k] & (MASK_LINE | MASK_TARGET)) > 0
        if fg.any():
            masks[k][_dilate(fg, 3) & ~_dilate(fg, 1)] |= MASK_RING
    # noise: static column stripes (alternating variant), static row offsets, static FPN, hot/dead pixels, temporal noise
    col = rng.normal(0, stripe_amp, w) if stripe_amp > 0 else np.zeros(w)
    if kind == "alt_stripes_strong":
        col = col * 0.4 + stripe_amp * 0.8 * np.where(np.arange(w) % 2 == 0, 1.0, -1.0)
    rowo = rng.normal(0, row_amp, h) if row_amp > 0 else np.zeros(h)
    fixed = col[None, :] + rowo[:, None] + (rng.normal(0, fpn, (h, w)) if fpn > 0 else 0)
    noisy = clean + fixed[None] + rng.normal(0, temporal_sigma, clean.shape)
    if kind != "nostripe_flat":
        for _ in range(3):
            py, px = int(rng.integers(0, h)), int(rng.integers(0, w))
            noisy[:, py, px] += rng.choice([-700.0, 700.0])
    noisy = np.clip(np.rint(noisy), 0, COUNT_MAX).astype(np.uint16)
    clean = np.clip(clean, 0, COUNT_MAX).astype(np.float32)
    meta = {"scene_id": f"{kind}-s{int(seed):04d}", "recording_id": f"synthetic-rec-{int(seed):04d}", "kind": kind, "seed": int(seed),
            "stripe_amp": stripe_amp, "temporal_sigma": temporal_sigma, "frames": t, "height": h, "width": w,
            "challenge": CHALLENGES[kind]}
    return clean, noisy, masks, meta


# ---------------------------------------------------------------------------------------------
# dataset files
# ---------------------------------------------------------------------------------------------

def _frame_hashes(arr: np.ndarray) -> list:
    return [sha256_bytes(np.ascontiguousarray(f).tobytes()) for f in arr]


def write_split_npz(path: Path, scenes: list) -> str:
    np.savez_compressed(path, noisy=np.stack([s["noisy"] for s in scenes]), clean=np.stack([s["clean"] for s in scenes]),
                        masks=np.stack([s["masks"] for s in scenes]), scene_ids=np.array([s["meta"]["scene_id"] for s in scenes]))
    return sha256_file(path)


def build_synthetic_dataset(out_dir, version: str, train_seeds, val_seeds, test_seeds, h=64, w=64, t=8, kinds=None, note=""):
    """Write a versioned synthetic dataset. Scenes are split by SEED (= generator scene identity), never by shuffling frames."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    kinds = kinds or KINDS
    split_seeds = {"train": list(train_seeds), "val": list(val_seeds), "test": list(test_seeds)}
    manifest = {"schema": "clearhot-dataset-v1", "dataset_version": version, "domain": "SYNTHETIC", "created": utc_now(),
                "generator_version": GENERATOR_VERSION, "note": note,
                "decoder": {"width": w, "height": h, "bits": 14, "little_endian": True, "shift": 0, "header_bytes": 0},
                "preprocessing": "none: arrays are 14-bit counts; noisy=uint16, clean=float32 counts",
                "target_provenance": {"kind": "synthetic_known_clean", "attested_by": "deterministic generator " + GENERATOR_VERSION},
                "masks_available": True, "scenes": [], "splits": {}}
    for split, seeds in split_seeds.items():
        scenes = []
        for seed in seeds:
            for kind in kinds:
                clean, noisy, masks, meta = make_scene(kind, seed, h, w, t)
                meta = dict(meta, split=split, noisy_frame_sha256=_frame_hashes(noisy), clean_frame_sha256=_frame_hashes(clean),
                            target_kind="synthetic_known_clean")
                scenes.append({"clean": clean, "noisy": noisy, "masks": masks, "meta": meta})
        fname = SPLIT_FILES[split]
        file_sha = write_split_npz(out / fname, scenes) if scenes else None
        manifest["splits"][split] = {"file": fname if scenes else None, "sha256": file_sha, "scenes": len(scenes)}
        manifest["scenes"] += [s["meta"] for s in scenes]
        if split == "test":
            manifest["splits"][split]["note"] = "RESERVED final test. Only `final-test --confirm-final-test` loads it; every use is logged."
    problems = validate_manifest(manifest)
    if problems:
        raise ClearHotError("generated dataset failed validation: " + "; ".join(problems))
    manifest["manifest_sha256"] = json_sha256({k: v for k, v in manifest.items() if k != "manifest_sha256"})
    atomic_write_json(out / "manifest.json", manifest)
    return manifest


def validate_manifest(m: dict) -> list:
    """Leakage / provenance validation. Returns a list of problems (empty = OK)."""
    p = []
    if m.get("schema") != "clearhot-dataset-v1":
        p.append("schema must be clearhot-dataset-v1")
    seen_scene, seen_rec, noisy_h, clean_h = {}, {}, {}, {}
    dims = set()
    for s in m.get("scenes", []):
        sp = s.get("split")
        if sp not in SPLITS:
            p.append(f"{s.get('scene_id')}: split must be one of {SPLITS}")
            continue
        tk = s.get("target_kind")
        if tk in REJECTED_TARGET_KINDS or tk not in ALLOWED_TARGET_KINDS:
            p.append(f"{s.get('scene_id')}: target_kind '{tk}' is not an accepted clean target (allowed: {sorted(ALLOWED_TARGET_KINDS)})")
        dims.add((s.get("height"), s.get("width")))
        for key, reg, label in (("scene_id", seen_scene, "scene"), ("recording_id", seen_rec, "recording")):
            v = s.get(key)
            if v is None:
                p.append(f"missing {key}")
            elif v in reg and reg[v] != sp:
                p.append(f"LEAKAGE: {label} {v} appears in splits {reg[v]} and {sp}")
            else:
                reg[v] = sp
        for hset, key in ((noisy_h, "noisy_frame_sha256"), (clean_h, "clean_frame_sha256")):
            for hh in s.get(key, []):
                if hh in hset and hset[hh] != sp:
                    p.append(f"LEAKAGE: identical frame content ({key[:5]}) {hh[:12]} in splits {hset[hh]} and {sp}")
                    break
                hset[hh] = sp
        if tk == "trusted_external_reference" and not m.get("attestation", {}).get("attested"):
            p.append("real targets require a human attestation")
        if s.get("noisy_frame_sha256") and s["noisy_frame_sha256"] == s.get("clean_frame_sha256"):
            p.append(f"{s.get('scene_id')}: target content is identical to input; not a clean target")
    if len(dims) > 1:
        p.append(f"inconsistent frame dimensions across scenes: {sorted(dims, key=str)}")
    return list(dict.fromkeys(p))


def verify_dataset_files(dir_) -> dict:
    """Re-validate manifest, manifest hash and split-file hashes (detects tampering, esp. of the reserved test split)."""
    d = Path(dir_)
    if not (d / "manifest.json").is_file():
        raise ClearHotError(f"{d}/manifest.json not found")
    m = read_json(d / "manifest.json")
    probs = validate_manifest(m)
    if m.get("manifest_sha256") != json_sha256({k: v for k, v in m.items() if k != "manifest_sha256"}):
        probs.append("manifest_sha256 does not match manifest content")
    for sp, info in m.get("splits", {}).items():
        if info.get("file"):
            f = d / info["file"]
            if not f.exists():
                probs.append(f"missing split file {info['file']}")
            elif sha256_file(f) != info["sha256"]:
                probs.append(f"split file {info['file']} hash mismatch (modified after creation)")
    if probs:
        raise ClearHotError("dataset validation FAILED:\n  - " + "\n  - ".join(probs))
    return m


FINAL_TEST_TOKEN = "FINAL_TEST_CONFIRMED"


def load_split(dir_, split: str, final_test_token=None) -> dict:
    """Load a split. The reserved test split needs the explicit gate token issued only by `final-test`."""
    if split == "test" and final_test_token != FINAL_TEST_TOKEN:
        raise ClearHotError("the reserved final test split cannot be loaded outside `final-test --confirm-final-test`")
    m = read_json(Path(dir_) / "manifest.json")
    info = m["splits"].get(split)
    if not info or not info.get("file"):
        raise ClearHotError(f"dataset has no '{split}' split")
    f = Path(dir_) / info["file"]
    if sha256_file(f) != info["sha256"]:
        raise ClearHotError(f"{f.name} was modified after the manifest was written (hash mismatch)")
    z = np.load(f, allow_pickle=False)
    ids = [str(x) for x in z["scene_ids"]]
    metas = {s["scene_id"]: s for s in m["scenes"]}
    return {"noisy": z["noisy"], "clean": z["clean"], "masks": z["masks"], "scene_ids": ids, "meta": [metas[i] for i in ids],
            "manifest": m, "file_sha256": info["sha256"]}


# ---------------------------------------------------------------------------------------------
# real, user-curated pairs
# ---------------------------------------------------------------------------------------------
DECODER_KEYS = ("width", "height", "header_bytes", "shift", "little_endian", "bits")


def _read_frames(path: str, dec: dict, indices: list) -> np.ndarray:
    w, h, hb = dec["width"], dec["height"], dec["header_bytes"]
    fb = w * h * 2
    size = os.path.getsize(path)
    frames = (size - hb) // fb if size >= hb else 0
    if frames < 1:
        raise ClearHotError(f"{path}: smaller than one complete frame for the declared decoder")
    out = []
    dt = "<u2" if dec["little_endian"] else ">u2"
    with open(path, "rb") as f:
        for i in indices:
            if not isinstance(i, int) or isinstance(i, bool) or i < 0 or i >= frames:
                raise ClearHotError(f"{path}: frame index {i} outside 0..{frames - 1}")
            f.seek(hb + i * fb)
            buf = f.read(fb)
            if len(buf) != fb:
                raise ClearHotError(f"{path}: short read at frame {i}")
            a = np.frombuffer(buf, dtype=dt).astype(np.uint16)
            out.append(((a >> dec["shift"]) & COUNT_MAX).reshape(h, w))
    return np.stack(out)


def import_real_pairs(manifest_path, out_dir, version=None, verbose=print) -> dict:
    """Validate a user-curated real-pair manifest and build a dataset directory. The tool cannot prove a target is clean
    or aligned: it requires a human attestation and enforces hash / dimension / split-disjointness rules."""
    mp = Path(manifest_path)
    base = mp.parent
    rm = read_json(mp)
    errs = []
    if rm.get("schema") != "clearhot-real-pairs-v1":
        raise ClearHotError("schema must be clearhot-real-pairs-v1 (see examples/real_pairs_manifest.example.json)")
    dec = rm.get("decoder", {})
    for k in DECODER_KEYS:
        if k not in dec:
            errs.append(f"decoder.{k} missing")
    if not errs and (dec["bits"] != 14 or dec["shift"] not in (0, 1, 2) or dec["width"] < 32 or dec["height"] < 32):
        errs.append("only 14-bit-in-uint16 (shift 0..2) is supported; other layouts are NOT IMPLEMENTED")
    att = rm.get("attestation", {})
    if not (att.get("attested") is True and att.get("reviewer") and len(att.get("statement", "")) >= 20):
        errs.append("attestation.attested=true, attestation.reviewer and a written attestation.statement are required "
                    "(you attest the targets are trusted, aligned, and in the same count domain)")
    if errs:
        raise ClearHotError("manifest invalid:\n  - " + "\n  - ".join(errs))
    recs = rm.get("recordings", [])
    if not recs:
        raise ClearHotError("manifest has no recordings")
    splits_data = {s: [] for s in SPLITS}
    hash_split, rec_split = {}, {}
    for r in recs:
        rid, sp = r.get("recording_id"), r.get("split")
        if not rid or sp not in SPLITS:
            errs.append(f"recording needs recording_id and split in {SPLITS}: {rid}")
            continue
        if rid in rec_split and rec_split[rid] != sp:
            errs.append(f"LEAKAGE: recording {rid} assigned to two splits")
        rec_split[rid] = sp
        tgt, inp = r.get("target", {}), r.get("input", {})
        tk = tgt.get("target_kind")
        if tk != "trusted_external_reference":
            errs.append(f"{rid}: target_kind '{tk}' rejected; real targets must be 'trusted_external_reference' "
                        "(adjacent noisy frames, blurred frames, model predictions and labels are not clean targets)")
            continue
        if tgt.get("same_count_domain") is not True or tgt.get("alignment_attested") is not True:
            errs.append(f"{rid}: target.same_count_domain and target.alignment_attested must both be true")
            continue
        ip, tp = base / inp.get("path", "-"), base / tgt.get("path", "-")
        if not ip.is_file() or not tp.is_file():
            errs.append(f"{rid}: input/target file missing")
            continue
        ih, th = sha256_file(ip), sha256_file(tp)
        if ih != inp.get("sha256") or th != tgt.get("sha256"):
            errs.append(f"{rid}: full-file SHA-256 mismatch (input {ih[:12]} / target {th[:12]})")
            continue
        if ih == th:
            errs.append(f"{rid}: input and target are the same file content; not a clean target")
            continue
        for hv, label in ((ih, "input"), (th, "target")):
            if hv in hash_split and hash_split[hv] != sp:
                errs.append(f"LEAKAGE: {label} file {hv[:12]} used in splits {hash_split[hv]} and {sp} (duplicate recording across splits)")
            hash_split[hv] = sp
        tdec = dict(dec, **tgt.get("decoder", {}))
        if any(tdec[k] != dec[k] for k in DECODER_KEYS):
            errs.append(f"{rid}: target decoder differs from input decoder; unsupported (convert to the same count domain first)")
            continue
        pairs = r.get("pairs", [])
        fi = [q.get("frame_index") for q in pairs]
        ti = [q.get("target_frame_index", q.get("frame_index")) for q in pairs]
        if not pairs or len(set(map(str, fi))) != len(fi):
            errs.append(f"{rid}: pairs missing or duplicate frame indices")
            continue
        try:
            noisy, clean = _read_frames(str(ip), dec, fi), _read_frames(str(tp), dec, ti)
        except ClearHotError as e:
            errs.append(str(e))
            continue
        if any(np.array_equal(a, b) for a, b in zip(noisy, clean)):
            errs.append(f"{rid}: a target frame is bit-identical to its input")
            continue
        # Optional user-created annotation file: 3-D uint8 .npy, one mask per selected pair,
        # values are bit flags LINE=1, TARGET=2, RING=4. Never fabricate missing evidence.
        masks = np.zeros(noisy.shape, np.uint8)
        mask_meta = r.get("masks")
        mask_sha = None
        if mask_meta is not None:
            if not isinstance(mask_meta, dict) or mask_meta.get("attested") is not True or not mask_meta.get("reviewer"):
                errs.append(f"{rid}: masks require attested=true and reviewer")
                continue
            mask_path = base / mask_meta.get("path", "-")
            if not mask_path.is_file() or mask_path.suffix.lower() != ".npy":
                errs.append(f"{rid}: mask file must be an existing .npy file")
                continue
            mask_sha = sha256_file(mask_path)
            if mask_sha != mask_meta.get("sha256"):
                errs.append(f"{rid}: mask full-file SHA-256 mismatch")
                continue
            try:
                masks = np.load(mask_path, allow_pickle=False)
            except Exception as exc:
                errs.append(f"{rid}: cannot read mask file: {exc}")
                continue
            if masks.dtype != np.uint8 or masks.shape != noisy.shape or np.any(masks > 7):
                errs.append(f"{rid}: masks must be uint8 with shape {noisy.shape} and bit values 0..7")
                continue
            if np.any(((masks & MASK_RING) > 0) & ((masks & (MASK_LINE | MASK_TARGET)) > 0)):
                errs.append(f"{rid}: ring pixels must not overlap line or target pixels")
                continue
        neg = r.get("stripe_free_negative", False)
        if neg is not False and neg is not True:
            errs.append(f"{rid}: stripe_free_negative must be boolean")
            continue
        if neg and (not r.get("stripe_free_reviewer") or len(r.get("stripe_free_statement", "")) < 20):
            errs.append(f"{rid}: stripe-free classification needs reviewer and explanatory statement")
            continue
        splits_data[sp].append({"clean": clean.astype(np.float32), "noisy": noisy, "masks": masks,
                                "meta": {"scene_id": f"{rid}", "recording_id": rid, "kind": "nostripe_flat" if neg else "real", "split": sp, "frames": len(fi),
                                         "mask_sha256": mask_sha, "mask_reviewer": mask_meta.get("reviewer") if mask_meta else None,
                                         "stripe_free_reviewer": r.get("stripe_free_reviewer") if neg else None,
                                         "stripe_free_statement": r.get("stripe_free_statement") if neg else None,
                                         "height": dec["height"], "width": dec["width"], "target_kind": tk,
                                         "input_file_sha256": ih, "target_file_sha256": th, "frame_indices": fi, "target_frame_indices": ti,
                                         "noisy_frame_sha256": _frame_hashes(noisy), "clean_frame_sha256": _frame_hashes(clean),
                                         "target_description": tgt.get("description", "")}})
    if errs:
        raise ClearHotError("real-pair import REJECTED:\n  - " + "\n  - ".join(dict.fromkeys(errs)))
    if not splits_data["train"] or not splits_data["val"]:
        raise ClearHotError("a real dataset needs at least one train recording and one DIFFERENT validation recording")
    out = Path(out_dir)
    if out.exists() and any(out.iterdir()):
        raise ClearHotError(f"{out} already exists and is not empty; choose a new dataset directory")
    # Existing NPZ layout requires the same number of pairs per scene within a split.
    for sp, scenes in splits_data.items():
        if len({len(sc["noisy"]) for sc in scenes}) > 1:
            raise ClearHotError(f"{sp}: all recordings in a split must have the same number of selected pairs")
    out.mkdir(parents=True, exist_ok=True)
    version = version or rm.get("dataset_name", "real-v1")
    man = {"schema": "clearhot-dataset-v1", "dataset_version": version, "domain": "REAL_USER_CURATED", "created": utc_now(),
           "generator_version": "real-import-1.1", "decoder": dec,
           "masks_available": any(sc["meta"].get("mask_sha256") for scenes in splits_data.values() for sc in scenes), "attestation": att,
           "preprocessing": "decoded to 14-bit counts exactly as the viewer does (shift then mask)",
           "limitations": ["Different file hashes are not proof of independent scenes/devices.",
                           "A single recording yields only exploratory time-block results."],
           "scenes": [], "splits": {}}
    for sp in SPLITS:
        sc = splits_data[sp]
        if sc:
            man["splits"][sp] = {"file": SPLIT_FILES[sp], "sha256": write_split_npz(out / SPLIT_FILES[sp], sc), "scenes": len(sc)}
            man["scenes"] += [s["meta"] for s in sc]
        else:
            man["splits"][sp] = {"file": None, "sha256": None, "scenes": 0}
    probs = validate_manifest(man)
    if probs:
        raise ClearHotError("imported dataset failed validation: " + "; ".join(probs))
    man["manifest_sha256"] = json_sha256({k: v for k, v in man.items() if k != "manifest_sha256"})
    atomic_write_json(out / "manifest.json", man)
    verbose(f"imported real dataset '{version}': " + ", ".join(f"{k}={v['scenes']}" for k, v in man["splits"].items()))
    return man
