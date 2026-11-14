"""`python -m clearhot_cnn <command>` — local-only command line for the controlled offline CNN loop."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from . import TOOL_VERSION
from .common import ClearHotError, atomic_write_json, atomic_write_bytes, json_sha256, read_json
from .data import FINAL_TEST_TOKEN, build_synthetic_dataset, import_real_pairs, make_scene, verify_dataset_files
from .evaluate import evaluate, report_csv
from .infer import build_cache
from .model import load_checkpoint
from .registry import Registry
from .train import pick_device, train

FINAL_PHRASE = "RUN FINAL TEST ONCE"


def _ints(s):
    return [int(x) for x in s.split(",") if x != ""]


def _dec(a):
    return {"width": a.width, "height": a.height, "header_bytes": a.header_bytes, "shift": a.shift, "little_endian": not a.big_endian, "bits": 14}


def _load(reg: Registry, cid: str):
    return load_checkpoint(reg.checkpoint_path(cid), expected_sha256=reg.record(cid)["checkpoint_sha256"])


def build_parser():
    p = argparse.ArgumentParser(prog="clearhot_cnn", description=f"ClearHot controlled offline CNN loop v{TOOL_VERSION}. Local only: no network, no uploads.")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("make-synth", help="generate a versioned SYNTHETIC known-clean dataset (train/val/reserved test split by scene seed)")
    s.add_argument("--out", required=True); s.add_argument("--version", default="synth-v1")
    s.add_argument("--train-seeds", default="0,1,2"); s.add_argument("--val-seeds", default="100"); s.add_argument("--test-seeds", default="200")
    s.add_argument("--size", type=int, default=64); s.add_argument("--frames", type=int, default=8); s.add_argument("--note", default="")
    s = sub.add_parser("validate-data", help="re-validate a dataset: leakage, hashes, provenance"); s.add_argument("dataset")
    s = sub.add_parser("import-real", help="import USER-CURATED trusted pairs from a clearhot-real-pairs-v1 manifest")
    s.add_argument("--manifest", required=True); s.add_argument("--out", required=True); s.add_argument("--version")
    s = sub.add_parser("make-recording", help="write a tiny generated SYNTHETIC headerless uint16 recording (for viewer tests/demo)")
    s.add_argument("--out", required=True); s.add_argument("--frames", type=int, default=90); s.add_argument("--size", type=int, default=64)
    s.add_argument("--kind", default="bridge_motion"); s.add_argument("--seed", type=int, default=300)
    s = sub.add_parser("train", help="train a candidate (never promotes)")
    s.add_argument("--dataset", required=True); s.add_argument("--registry", required=True)
    s.add_argument("--steps", type=int, default=1500); s.add_argument("--seed", type=int, default=0); s.add_argument("--batch", type=int, default=16)
    s.add_argument("--lr", type=float, default=3e-3); s.add_argument("--device", default="cpu", help="cpu | mps | auto"); s.add_argument("--threads", type=int, default=1)
    s.add_argument("--demo-fault", choices=["bias"], help="TEST/DEMO ONLY: corrupt the targets to demonstrate gate rejection")
    s.add_argument("--simulated-demo", action="store_true", help="label the candidate SIMULATED/DEMO"); s.add_argument("--note", default="")
    s = sub.add_parser("evaluate", help="evaluate a candidate on the VALIDATION split against raw, original Argos 2 and the promoted model")
    s.add_argument("--registry", required=True); s.add_argument("--dataset", required=True); s.add_argument("--id", required=True)
    s.add_argument("--gates", help="JSON file overriding gate thresholds"); s.add_argument("--test-only-thresholds", action="store_true")
    s.add_argument("--device", default="cpu")
    s = sub.add_parser("status", help="show registry state"); s.add_argument("--registry", required=True)
    s = sub.add_parser("approve", help="HUMAN approval + promotion of a validated candidate")
    s.add_argument("--registry", required=True); s.add_argument("--id", required=True); s.add_argument("--reviewer", required=True)
    s.add_argument("--note", default=""); s.add_argument("--confirm-approve", required=True, help="type the checkpoint id again")
    s = sub.add_parser("reject", help="record a human rejection")
    s.add_argument("--registry", required=True); s.add_argument("--id", required=True); s.add_argument("--reviewer", required=True); s.add_argument("--note", default="")
    s = sub.add_parser("rollback", help="restore the previous active state (possibly 'classical only')")
    s.add_argument("--registry", required=True); s.add_argument("--reviewer", required=True); s.add_argument("--note", default="")
    s = sub.add_parser("infer", help="process a local recording into a labelled non-destructive cache for the viewer")
    s.add_argument("--registry", required=True); s.add_argument("--source", required=True); s.add_argument("--out", required=True)
    s.add_argument("--width", type=int, default=640); s.add_argument("--height", type=int, default=512)
    s.add_argument("--header-bytes", type=int, default=0); s.add_argument("--shift", type=int, default=0); s.add_argument("--big-endian", action="store_true")
    s.add_argument("--model", default="active"); s.add_argument("--allow-unapproved", action="store_true")
    s.add_argument("--start", type=int, default=0); s.add_argument("--end", type=int); s.add_argument("--yes", action="store_true")
    s.add_argument("--device", default="cpu")
    s = sub.add_parser("final-test", help="SEPARATELY GATED evaluation on the reserved final test split; every call is logged")
    s.add_argument("--registry", required=True); s.add_argument("--dataset", required=True); s.add_argument("--id", required=True)
    s.add_argument("--reviewer", required=True); s.add_argument("--confirm-final-test", required=True, help=f'must equal "{FINAL_PHRASE}"')
    return p


def main(argv=None):
    a = build_parser().parse_args(argv)
    try:
        return _run(a) or 0
    except ClearHotError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


def _run(a):
    if a.cmd == "make-synth":
        m = build_synthetic_dataset(a.out, a.version, _ints(a.train_seeds), _ints(a.val_seeds), _ints(a.test_seeds), a.size, a.size, a.frames, note=a.note)
        print(f"SYNTHETIC dataset '{a.version}' written to {a.out}: " + ", ".join(f"{k}={v['scenes']} scenes" for k, v in m["splits"].items()))
        print(f"manifest_sha256={m['manifest_sha256']}")
    elif a.cmd == "validate-data":
        m = verify_dataset_files(a.dataset)
        print(f"OK: {m['dataset_version']} ({m['domain']}) — no leakage found by the declared checks; " + ", ".join(f"{k}={v['scenes']}" for k, v in m["splits"].items()))
        print("Limitation: different file hashes do not prove independent scenes/devices.")
    elif a.cmd == "import-real":
        import_real_pairs(a.manifest, a.out, a.version)
    elif a.cmd == "make-recording":
        _, noisy, _, meta = make_scene(a.kind, a.seed, a.size, a.size, a.frames)
        atomic_write_bytes(a.out, noisy.astype("<u2").tobytes())
        print(f"wrote SYNTHETIC recording {a.out}: {a.frames} frames of {a.size}x{a.size}, headerless little-endian uint16 ({meta['scene_id']})")
    elif a.cmd == "train":
        reg = Registry(a.registry)
        print(f"training on {a.dataset} (device {pick_device(a.device)}, seed {a.seed}, {a.steps} steps)")
        r = train(a.dataset, a.steps, a.seed, a.batch, lr=a.lr, device=a.device, demo_fault=a.demo_fault, threads=a.threads)
        cid = reg.register_candidate(r["bytes"], r["info"], simulated_demo=bool(a.simulated_demo or a.demo_fault), note=a.note)
        print(f"registered CANDIDATE {cid} (not validated, not approved). weights_sha256={r['info']['weights_sha256'][:16]}")
    elif a.cmd == "evaluate":
        reg = Registry(a.registry)
        net, ck = _load(reg, a.id)
        rec = reg.record(a.id)
        gates = read_json(a.gates) if a.gates else None
        pid, ppath = reg.active()
        promoted = None
        if pid and pid != a.id:
            pm, _ = _load(reg, pid)
            promoted = (pm, {"id": pid})
        rep = evaluate(a.dataset, "val", (net, {"id": a.id}), promoted, gates, a.device, test_only_thresholds=a.test_only_thresholds)
        r2 = reg.attach_validation(a.id, rep)
        print_report(rep)
        print(f"\n=> {a.id}: {r2['status'].upper()}  (human approval is still required to use it: `approve`)")
    elif a.cmd == "status":
        reg = Registry(a.registry)
        aid, _ = reg.active()
        print(f"ACTIVE: {aid or 'none — classical only (Argos 2 stays the reference)'}")
        for r in reg.list():
            print(f"  {r['id']}  {r['status']:<18} {r['label']}  steps={r['steps']} dataset={r['dataset']['version']}")
    elif a.cmd == "approve":
        r = Registry(a.registry).approve_and_promote(a.id, a.reviewer, a.note, a.confirm_approve)
        print(f"APPROVED and ACTIVE: {r['id']} (reviewer {r['approval']['reviewer']}; previous: {r['approval']['previous_active']})")
    elif a.cmd == "reject":
        Registry(a.registry).reject(a.id, a.reviewer, a.note)
        print(f"REJECTED {a.id}")
    elif a.cmd == "rollback":
        r = Registry(a.registry).rollback(a.reviewer, a.note)
        print(f"ROLLED BACK: {r['from']} -> {r['to'] or 'classical only (no CNN)'}")
    elif a.cmd == "infer":
        build_cache(Registry(a.registry), a.source, a.out, _dec(a), a.model, a.allow_unapproved, a.start, a.end, a.yes, a.device)
    elif a.cmd == "final-test":
        if a.confirm_final_test != FINAL_PHRASE:
            raise ClearHotError(f'the final test is irreversible bookkeeping; pass --confirm-final-test "{FINAL_PHRASE}"')
        reg = Registry(a.registry)
        verify_dataset_files(a.dataset)  # test split must be unmodified
        net, _ = _load(reg, a.id)
        rep = evaluate(a.dataset, "test", (net, {"id": a.id}), None, None, "cpu", final_test_token=FINAL_TEST_TOKEN)
        n = reg.log_final_test(a.id, rep["dataset"]["manifest_sha256"], a.reviewer, json_sha256(rep))
        atomic_write_json(Path(a.registry) / "candidates" / a.id / f"final_test_report_{n}.json", rep)
        print_report(rep)
        print(f"\nFinal-test invocation #{n} logged. This result must not be used to choose between models.")
    return 0


def print_report(rep):
    print(f"[{rep['label']}] split={rep['split']} scenes={rep['n_scenes']} frames={rep['n_frames_total']} domain: {rep['domain']}")
    print(f"{'method':<10} " + " ".join(f"{k:>14}" for k in ("mae_counts", "rmse_counts", "psnr_db", "ssim", "stripe_residual_counts", "motion_err_counts")))
    for m, v in rep["aggregate_mean_over_scenes"].items():
        print(f"{m:<10} " + " ".join(f"{v[k]:14.4f}" for k in ("mae_counts", "rmse_counts", "psnr_db", "ssim", "stripe_residual_counts", "motion_err_counts")))
    print("gates (mandatory):")
    for g in rep["gates"]:
        print(f"  [{'PASS' if g['passed'] else 'FAIL'}] {g['name']}: value={g['value']} threshold={g['threshold']} {g['detail']}")
    if rep["failure_cases_candidate_worse_than_baseline"]:
        print("scenes where the candidate is worse than raw or Argos 2 (MAE counts): " + ", ".join(c["scene_id"] for c in rep["failure_cases_candidate_worse_than_baseline"]))


if __name__ == "__main__":
    sys.exit(main())
