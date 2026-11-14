"""Candidate evaluation: SAME inputs through raw/identity, the frozen original Argos 2 (stage-1 cleaned counts), the currently
promoted checkpoint (if any) and the candidate; per-scene metrics; declared, configurable engineering gates.

Domain note: all numeric comparison happens in 14-bit COUNTS. Argos 2's native 8-bit AGC/tone output is produced by the same run
and kept separately; it is not numerically compared with counts. Gate thresholds are engineering checks on synthetic fixtures,
not scientific constants and not evidence of real-footage quality."""
from __future__ import annotations

import csv
import io
import time

import numpy as np

from .baseline import engine_provenance, run_classical
from .common import ClearHotError, code_sha256, environment_info, json_sha256, utc_now
from .data import SPLITS, load_split, FINAL_TEST_TOKEN
from .metrics import AGG_KEYS, DEFINITIONS, scene_metrics
from .model import predict_counts

DEFAULT_GATES = {
    "max_mae_ratio_vs_raw": 0.85,        # candidate must cut mean count-domain MAE by >=15% vs raw on the validation set
    "max_mae_ratio_vs_argos2": 1.00,     # ... and not be worse than Argos 2 stage-1 cleaned counts
    "max_scene_mae_ratio_vs_argos2": 1.25,
    "max_false_correction_ratio": 1.02,  # stripe-free scenes must not be made worse than raw
    "line_retention_range": [0.70, 1.30],
    "target_retention_range": [0.70, 1.30],
    "max_ring_bias_ratio": 0.15,
    "max_overshoot_p99_ratio": 0.60,
    "max_clip_increase": 0.001,
    "max_scene_motion_err_ratio_vs_raw": 1.00,
    "max_mae_ratio_vs_promoted": 1.02,
    "max_scene_mae_ratio_vs_promoted": 1.25,
}


def _vals(per_scene, method, key, kinds=None):
    return [s["methods"][method][key] for s in per_scene if s["methods"][method].get(key) is not None and (kinds is None or s["kind"] in kinds)]


def _gate(name, passed, value, threshold, detail="", mandatory=True):
    return {"name": name, "mandatory": mandatory, "passed": bool(passed), "value": value, "threshold": threshold, "detail": detail}


def evaluate_gates(per_scene: list, have_promoted: bool, g: dict) -> list:
    c = "candidate"
    G = []
    G.append(_gate("finite_outputs", all(s["methods"][c]["finite"] for s in per_scene), None, "all finite"))
    mr = np.mean(_vals(per_scene, c, "mae_counts")) / np.mean(_vals(per_scene, "raw", "mae_counts"))
    G.append(_gate("mae_improves_vs_raw", mr <= g["max_mae_ratio_vs_raw"], float(mr), g["max_mae_ratio_vs_raw"], "mean MAE(candidate)/mean MAE(raw), validation scenes"))
    ma = np.mean(_vals(per_scene, c, "mae_counts")) / np.mean(_vals(per_scene, "argos2", "mae_counts"))
    G.append(_gate("not_worse_than_argos2", ma <= g["max_mae_ratio_vs_argos2"], float(ma), g["max_mae_ratio_vs_argos2"], "mean MAE(candidate)/mean MAE(Argos 2 stage-1 counts)"))
    worst = max((s["methods"][c]["mae_counts"] / max(s["methods"]["argos2"]["mae_counts"], 1e-9), s["scene_id"]) for s in per_scene)
    G.append(_gate("no_scene_much_worse_than_argos2", worst[0] <= g["max_scene_mae_ratio_vs_argos2"], float(worst[0]), g["max_scene_mae_ratio_vs_argos2"], f"worst scene: {worst[1]}"))
    fc = _vals(per_scene, c, "false_correction_ratio")
    G.append(_gate("no_stripe_false_correction", (max(fc) <= g["max_false_correction_ratio"]) if fc else False, float(max(fc)) if fc else None,
                   g["max_false_correction_ratio"], "stripe-free scenes: MAE(cand)/MAE(raw)" + ("" if fc else " — NO stripe-free scene in this split: gate cannot pass")))
    for key, nm in (("line_retention", "line_retention_range"), ("target_retention", "target_retention_range")):
        v = _vals(per_scene, c, key)
        lo, hi = g[nm]
        G.append(_gate(nm, bool(v) and min(v) >= lo and max(v) <= hi, [float(min(v)), float(max(v))] if v else None, [lo, hi],
                       "worst-case over scenes with such features" + ("" if v else " — no masks available: gate cannot pass")))
    for key, nm in (("ring_bias_ratio", "max_ring_bias_ratio"), ("overshoot_p99_ratio", "max_overshoot_p99_ratio")):
        v = _vals(per_scene, c, key)
        G.append(_gate(nm, bool(v) and max(v) <= g[nm], float(max(v)) if v else None, g[nm], "worst case over scenes (halo / overshoot)"))
    ci = _vals(per_scene, c, "clip_increase")
    G.append(_gate("max_clip_increase", max(ci) <= g["max_clip_increase"], float(max(ci)), g["max_clip_increase"]))
    mo = max((s["methods"][c]["motion_err_counts"] / max(s["methods"]["raw"]["motion_err_counts"], 1e-9), s["scene_id"]) for s in per_scene)
    G.append(_gate("motion_artifacts", mo[0] <= g["max_scene_motion_err_ratio_vs_raw"], float(mo[0]), g["max_scene_motion_err_ratio_vs_raw"], f"worst scene {mo[1]}: temporal-difference error vs raw"))
    if have_promoted:
        mp = np.mean(_vals(per_scene, c, "mae_counts")) / np.mean(_vals(per_scene, "promoted", "mae_counts"))
        G.append(_gate("no_regression_vs_promoted_mean", mp <= g["max_mae_ratio_vs_promoted"], float(mp), g["max_mae_ratio_vs_promoted"]))
        wp = max((s["methods"][c]["mae_counts"] / max(s["methods"]["promoted"]["mae_counts"], 1e-9), s["scene_id"]) for s in per_scene)
        G.append(_gate("no_scene_regression_vs_promoted", wp[0] <= g["max_scene_mae_ratio_vs_promoted"], float(wp[0]), g["max_scene_mae_ratio_vs_promoted"], f"worst scene {wp[1]}"))
    return G


def evaluate(dataset_dir, split, candidate, promoted=None, gates=None, device="cpu", final_test_token=None, candidate_info=None, test_only_thresholds=False) -> dict:
    """candidate / promoted: (model, record_dict) or None. Returns the full report dict (not yet persisted)."""
    if split not in SPLITS:
        raise ClearHotError("split must be train|val|test")
    if split == "test" and final_test_token != FINAL_TEST_TOKEN:
        raise ClearHotError("final test split is gated")
    if split == "train":
        raise ClearHotError("evaluating on the training split is not a valid acceptance test")
    g = dict(DEFAULT_GATES, **(gates or {}))
    d = load_split(dataset_dir, split, final_test_token)
    S, T, H, W = d["noisy"].shape
    flat = d["noisy"].reshape(S * T, H, W)
    t0 = time.time()
    cls = run_classical(flat, [T] * S, "argos2")
    outs = {"raw": d["noisy"].astype(np.float32), "argos2": cls["restored"].reshape(S, T, H, W)}
    timing = {"argos2_ms_per_frame_node_wrapper": cls["ms_per_frame"]}
    methods = ["raw", "argos2"]
    for name, item in (("promoted", promoted), ("candidate", candidate)):
        if item is None:
            continue
        t1 = time.time()
        outs[name] = np.stack([[predict_counts(item[0], d["noisy"][s, t], device=device) for t in range(T)] for s in range(S)])
        timing[f"{name}_ms_per_frame"] = (time.time() - t1) * 1000 / (S * T)
        methods.append(name)
    if "candidate" not in outs:
        raise ClearHotError("a candidate is required")
    per_scene = []
    for s in range(S):
        mt = {m: scene_metrics(outs[m][s], d["noisy"][s], d["clean"][s], d["masks"][s], d["meta"][s]["kind"]) for m in methods}
        per_scene.append({"scene_id": d["scene_ids"][s], "recording_id": d["meta"][s]["recording_id"], "kind": d["meta"][s]["kind"],
                          "challenge": d["meta"][s].get("challenge", ""), "frames": T, "methods": mt})
    aggregate = {m: {k: float(np.mean([sc["methods"][m][k] for sc in per_scene])) for k in AGG_KEYS} for m in methods}
    G = evaluate_gates(per_scene, "promoted" in outs, g)
    failures = [x for x in G if not x["passed"]]
    # per-scene failure cases: scenes where the candidate is worse than raw or Argos 2 in counts MAE
    cases = [{"scene_id": s["scene_id"], "kind": s["kind"], "candidate_mae": s["methods"]["candidate"]["mae_counts"], "argos2_mae": s["methods"]["argos2"]["mae_counts"],
              "raw_mae": s["methods"]["raw"]["mae_counts"]} for s in per_scene
             if s["methods"]["candidate"]["mae_counts"] > min(s["methods"]["argos2"]["mae_counts"], s["methods"]["raw"]["mae_counts"])]
    info = candidate[1] if candidate[1] else {}
    return {"schema": "clearhot-eval-report-v1", "label": "SYNTHETIC — functional demonstration only" if d["manifest"]["domain"] == "SYNTHETIC" else d["manifest"]["domain"],
            "split": split, "created": utc_now(), "n_scenes": S, "frames_per_scene": T, "frame_size": [H, W], "n_frames_total": S * T,
            "domain": "14-bit counts (float). Argos 2 native 8-bit output is NOT compared numerically with counts.",
            "methods": {"raw": "identity / raw counts", "argos2": "ORIGINAL Argos 2 engine, original default config, stage-1 cleaned counts (stage1Clean14); later stages are display-domain",
                        "promoted": (promoted[1] or {}).get("id") if promoted else None, "candidate": info.get("id")},
            "metric_definitions": DEFINITIONS, "gates_config": g, "gates_config_is_test_only": bool(test_only_thresholds),
            "gates": G, "all_mandatory_passed": all(x["passed"] for x in G if x["mandatory"]), "failed_gates": [x["name"] for x in failures],
            "aggregate_mean_over_scenes": aggregate, "per_scene": per_scene, "failure_cases_candidate_worse_than_baseline": cases,
            "dataset": {"version": d["manifest"]["dataset_version"], "manifest_sha256": d["manifest"]["manifest_sha256"], "split_file_sha256": d["file_sha256"],
                        "domain": d["manifest"]["domain"]},
            "baseline_provenance": engine_provenance(), "baseline_native_config": cls["meta"]["config"], "timing": dict(timing, wall_seconds=time.time() - t0,
            note="CPU wall-clock on this machine for this tiny fixture; not a real-time claim"),
            "code_sha256": code_sha256(), "env": environment_info(), "device": device,
            "limitations": ["Synthetic scenes only: no claim about real footage, temperature or generalisation.",
                            "Gate thresholds are declared engineering checks, not universal constants.",
                            "Single-frame model: temporal behaviour is only checked via frame-difference error."]}


def report_csv(report: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    cols = AGG_KEYS + ["line_retention", "target_retention", "ring_bias_ratio", "overshoot_p99_ratio", "false_correction_ratio"]
    w.writerow(["scene_id", "kind", "method"] + cols)
    for s in report["per_scene"]:
        for m, v in s["methods"].items():
            w.writerow([s["scene_id"], s["kind"], m] + ["" if v.get(c) is None else f"{v[c]:.6g}" for c in cols])
    return buf.getvalue()
