"""Automated tests for the controlled offline CNN loop. Run: `cd training && PYTHONPATH=. python3 -m unittest discover -s tests -v`.

IMPORTANT: the end-to-end test uses TEST-ONLY relaxed gate thresholds (tests/ gates below) and tiny training runs so it finishes in
about a minute. That demonstrates the MECHANISM (train -> evaluate -> approve -> second cycle -> reject -> rollback -> restart -> infer);
it is not product safety evidence and says nothing about real footage."""
import hashlib
import io
import json
import os
import shutil
import socket
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

import numpy as np
import torch

from clearhot_cnn import cli
from clearhot_cnn.common import ClearHotError, json_sha256, sha256_file
from clearhot_cnn.data import (FINAL_TEST_TOKEN, build_synthetic_dataset, import_real_pairs, load_split, make_scene, validate_manifest,
                               verify_dataset_files)
from clearhot_cnn.infer import build_cache
from clearhot_cnn.model import ClearHotNet, load_checkpoint, predict_counts, weights_sha256
from clearhot_cnn.registry import Registry
from clearhot_cnn.train import train

ROOT = Path(__file__).resolve().parents[2]
E2E_DIR = ROOT / "build" / "e2e"
TEST_ONLY_GATES = {"line_retention_range": [0.0, 2.0], "target_retention_range": [0.2, 2.0], "max_mae_ratio_vs_raw": 0.95,
                   "max_mae_ratio_vs_promoted": 1.6, "max_scene_mae_ratio_vs_promoted": 3.0, "max_scene_mae_ratio_vs_argos2": 2.0}


def run_cli(*argv):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = cli.main([str(a) for a in argv])
    return code, out.getvalue(), err.getvalue()


class DataTests(unittest.TestCase):
    def test_generator_is_deterministic_and_labelled_synthetic(self):
        a, b = make_scene("wire_vertical", 5), make_scene("wire_vertical", 5)
        self.assertTrue(np.array_equal(a[1], b[1]))
        self.assertFalse(np.array_equal(a[1], make_scene("wire_vertical", 6)[1]))
        self.assertEqual(a[0].shape, (8, 64, 64))

    def test_split_by_scene_and_leakage_rejection(self):
        with tempfile.TemporaryDirectory() as td:
            m = build_synthetic_dataset(td, "t", [0, 1], [100], [200], kinds=["wire_vertical", "nostripe_flat"], t=4)
            self.assertEqual(validate_manifest(m), [])
            ids = {sp: {s["scene_id"] for s in m["scenes"] if s["split"] == sp} for sp in ("train", "val", "test")}
            self.assertFalse(ids["train"] & ids["val"] or ids["train"] & ids["test"] or ids["val"] & ids["test"])
            bad = json.loads(json.dumps(m))  # same recording in two splits
            next(s for s in bad["scenes"] if s["split"] == "val")["recording_id"] = next(s for s in bad["scenes"] if s["split"] == "train")["recording_id"]
            self.assertTrue(any("LEAKAGE" in p for p in validate_manifest(bad)))
            bad = json.loads(json.dumps(m))  # identical frame content in two splits
            next(s for s in bad["scenes"] if s["split"] == "val")["noisy_frame_sha256"][0] = next(s for s in bad["scenes"] if s["split"] == "train")["noisy_frame_sha256"][0]
            self.assertTrue(any("identical frame content" in p for p in validate_manifest(bad)))
            for kind in ("adjacent_frame", "blurred", "model_prediction", "unlabeled"):
                bad = json.loads(json.dumps(m))
                bad["scenes"][0]["target_kind"] = kind
                self.assertTrue(any("not an accepted clean target" in p for p in validate_manifest(bad)), kind)
            # tamper detection and reserved test gating
            verify_dataset_files(td)
            with self.assertRaises(ClearHotError):
                load_split(td, "test")
            self.assertEqual(load_split(td, "test", FINAL_TEST_TOKEN)["noisy"].shape[0], 2)
            with open(Path(td) / "val.npz", "ab") as f:
                f.write(b"x")
            with self.assertRaises(ClearHotError):
                verify_dataset_files(td)

    def _write_real(self, td, **over):
        rng = np.random.default_rng(1)
        dec = {"width": 32, "height": 32, "header_bytes": 0, "shift": 0, "little_endian": True, "bits": 14}
        recs = []
        for rid, split in (("recA", "train"), ("recB", "val")):
            clean = rng.integers(6000, 7000, (3, 32, 32)).astype("<u2")
            noisy = (clean + rng.integers(0, 50, clean.shape)).astype("<u2")
            (Path(td) / f"{rid}_in.u16").write_bytes(noisy.tobytes())
            (Path(td) / f"{rid}_ref.u16").write_bytes(clean.tobytes())
            recs.append({"recording_id": rid, "split": split, "input": {"path": f"{rid}_in.u16", "sha256": sha256_file(Path(td) / f"{rid}_in.u16")},
                         "target": {"path": f"{rid}_ref.u16", "sha256": sha256_file(Path(td) / f"{rid}_ref.u16"), "target_kind": "trusted_external_reference",
                                    "same_count_domain": True, "alignment_attested": True, "description": "TEST FIXTURE"},
                         "pairs": [{"frame_index": 0}, {"frame_index": 1}]})
        m = {"schema": "clearhot-real-pairs-v1", "dataset_name": "real-test", "decoder": dec,
             "attestation": {"attested": True, "reviewer": "tester", "statement": "TEST FIXTURE: targets are generated for a unit test only"}, "recordings": recs}
        m.update(over)
        p = Path(td) / "m.json"
        p.write_text(json.dumps(m))
        return p, m

    def test_real_pair_import_accepts_valid_and_rejects_bad(self):
        with tempfile.TemporaryDirectory() as td:
            p, m = self._write_real(td)
            man = import_real_pairs(p, Path(td) / "out", verbose=lambda *_: None)
            self.assertEqual(man["domain"], "REAL_USER_CURATED")
            verify_dataset_files(Path(td) / "out")

            def bad(mutate, needle):
                mm = json.loads(json.dumps(m))
                mutate(mm)
                p.write_text(json.dumps(mm))
                with self.assertRaises(ClearHotError) as cm:
                    import_real_pairs(p, Path(td) / "bad", verbose=lambda *_: None)
                self.assertIn(needle, str(cm.exception))
            bad(lambda x: x["recordings"][0]["input"].update(sha256="0" * 64), "SHA-256 mismatch")
            bad(lambda x: x["recordings"][0]["target"].update(target_kind="adjacent_frame"), "rejected")
            bad(lambda x: x["recordings"][0]["target"].update(target_kind="model_prediction"), "rejected")
            bad(lambda x: x["attestation"].update(attested=False), "attestation")
            bad(lambda x: x["recordings"][0]["target"].update(alignment_attested=False), "alignment_attested")
            bad(lambda x: x["recordings"][0]["pairs"].append({"frame_index": 99}), "outside")
            bad(lambda x: x["recordings"][1].update(input=dict(x["recordings"][0]["input"]), target=dict(x["recordings"][0]["target"])), "LEAKAGE")
            bad(lambda x: x["recordings"][0]["target"].update(path=x["recordings"][0]["input"]["path"], sha256=x["recordings"][0]["input"]["sha256"]), "same file")
            bad(lambda x: x["decoder"].update(bits=16), "NOT IMPLEMENTED")
            (Path(td) / "recA_in.u16").write_bytes(b"\x00" * 10)  # short file
            m2 = json.loads(json.dumps(m))
            m2["recordings"][0]["input"]["sha256"] = sha256_file(Path(td) / "recA_in.u16")
            p.write_text(json.dumps(m2))
            with self.assertRaises(ClearHotError) as cm:
                import_real_pairs(p, Path(td) / "bad2", verbose=lambda *_: None)
            self.assertIn("smaller than one complete frame", str(cm.exception))


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.td = tempfile.mkdtemp()
        build_synthetic_dataset(cls.td, "m", [0, 1], [100], [200], kinds=["stripe_blob", "wire_vertical", "nostripe_flat"], t=4)
        cls.res = train(cls.td, steps=60, seed=3, batch=8, eval_every=60, log=lambda *_: None)
        cls.ck = Path(cls.td) / "c.pt"
        cls.ck.write_bytes(cls.res["bytes"])

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.td, ignore_errors=True)

    def test_untrained_model_is_exact_identity_and_none_is_explicit_bypass(self):
        fr = make_scene("texture", 1)[1][0]
        self.assertTrue(np.allclose(predict_counts(ClearHotNet(), fr), fr.astype(np.float32), atol=1e-3))
        self.assertTrue(np.array_equal(predict_counts(None, fr), fr.astype(np.float32)))

    def test_real_weight_update_finite_and_reload_identity(self):
        info = self.res["info"]
        self.assertNotEqual(info["weights_sha256"], info["initial_weights_sha256"])
        net, ck = load_checkpoint(self.ck)
        self.assertEqual(weights_sha256(net), info["weights_sha256"])
        for k in ("optimizer_state", "history", "val_history", "code_sha256", "env", "dataset", "config"):
            self.assertIn(k, ck)
        fr = make_scene("texture", 1)[1][0]
        out = predict_counts(net, fr)
        self.assertTrue(np.isfinite(out).all() and out.min() >= 0 and out.max() <= 16383)
        self.assertFalse(np.array_equal(out, fr.astype(np.float32)))  # trained weights actually change the output

    def test_seed_reproducibility(self):
        again = train(self.td, steps=60, seed=3, batch=8, eval_every=60, log=lambda *_: None)
        self.assertEqual(again["info"]["weights_sha256"], self.res["info"]["weights_sha256"])

    def test_tiled_inference_equals_full_frame(self):
        net, _ = load_checkpoint(self.ck)
        fr = make_scene("alt_stripes_strong", 2, 64, 64, 2)[1][0]
        self.assertLess(float(np.abs(predict_counts(net, fr, tile=64) - predict_counts(net, fr, tile=23)).max()), 1e-2)

    def test_checkpoint_hash_mismatch_is_refused(self):
        with self.assertRaises(ClearHotError):
            load_checkpoint(self.ck, expected_sha256="0" * 64)


class LoopE2E(unittest.TestCase):
    """Two cycles, rejection of a failing candidate, rollback, restart, inference cache, final-test gate."""

    def test_two_cycles_reject_rollback_restart_and_infer(self):
        if E2E_DIR.exists():
            shutil.rmtree(E2E_DIR)
        E2E_DIR.mkdir(parents=True)
        gates = E2E_DIR / "TEST_ONLY_gates.json"
        gates.write_text(json.dumps(TEST_ONLY_GATES))
        ds1, ds2, reg_dir = E2E_DIR / "ds_v1", E2E_DIR / "ds_v2", E2E_DIR / "registry"
        self.assertEqual(run_cli("make-synth", "--out", ds1, "--version", "synth-v1", "--train-seeds", "0,1")[0], 0)
        self.assertEqual(run_cli("make-synth", "--out", ds2, "--version", "synth-v2", "--train-seeds", "0,1,2,3,4,5")[0], 0)
        m1, m2 = json.loads((ds1 / "manifest.json").read_text()), json.loads((ds2 / "manifest.json").read_text())
        self.assertEqual(m1["splits"]["val"]["sha256"], m2["splits"]["val"]["sha256"])  # frozen validation set across data versions
        self.assertEqual(m1["splits"]["test"]["sha256"], m2["splits"]["test"]["sha256"])  # untouched reserved test set
        reg = Registry(reg_dir)
        # ---- cycle 1
        self.assertEqual(run_cli("train", "--dataset", ds1, "--registry", reg_dir, "--steps", 700, "--seed", 1, "--simulated-demo")[0], 0)
        c1 = reg.list()[-1]["id"]
        self.assertEqual(reg.record(c1)["status"], "candidate")
        with self.assertRaises(ClearHotError):  # not validated -> cannot be approved
            reg.approve_and_promote(c1, "tester", "", c1)
        code, out, _ = run_cli("evaluate", "--registry", reg_dir, "--dataset", ds1, "--id", c1, "--gates", gates, "--test-only-thresholds")
        self.assertEqual(code, 0, out)
        self.assertEqual(reg.record(c1)["status"], "validated", out)
        with self.assertRaises(ClearHotError):  # validated but human has not confirmed
            reg.approve_and_promote(c1, "tester", "", "wrong")
        self.assertIsNone(reg.active()[0])  # no automatic promotion
        self.assertEqual(run_cli("approve", "--registry", reg_dir, "--id", c1, "--reviewer", "tester-1", "--confirm-approve", c1, "--note", "TEST-ONLY thresholds")[0], 0)
        self.assertEqual(reg.active()[0], c1)
        w1 = reg.record(c1)["weights_sha256"]
        # ---- cycle 2: more curated data (new dataset version), same frozen validation set; compared with promoted c1
        self.assertEqual(run_cli("train", "--dataset", ds2, "--registry", reg_dir, "--steps", 900, "--seed", 2, "--simulated-demo")[0], 0)
        c2 = [r for r in reg.list() if r["id"] != c1][-1]["id"]
        code, out, _ = run_cli("evaluate", "--registry", reg_dir, "--dataset", ds2, "--id", c2, "--gates", gates, "--test-only-thresholds")
        self.assertIn("no_regression_vs_promoted_mean", out)  # the promoted model took part in the comparison
        self.assertEqual(reg.record(c2)["status"], "validated", out)
        self.assertEqual(run_cli("approve", "--registry", reg_dir, "--id", c2, "--reviewer", "tester-1", "--confirm-approve", c2)[0], 0)
        self.assertEqual(reg.active()[0], c2)
        self.assertEqual(reg.record(c1)["status"], "retired")
        # ---- cycle 3: deliberately failing candidate (corrupted targets, demo fault) must be rejected, no override
        self.assertEqual(run_cli("train", "--dataset", ds2, "--registry", reg_dir, "--steps", 300, "--seed", 3, "--demo-fault", "bias")[0], 0)
        c3 = [r for r in reg.list() if r["id"] not in (c1, c2)][-1]["id"]
        self.assertTrue(reg.record(c3)["simulated_demo"])
        code, out, _ = run_cli("evaluate", "--registry", reg_dir, "--dataset", ds2, "--id", c3, "--gates", gates, "--test-only-thresholds")
        self.assertEqual(reg.record(c3)["status"], "validation_failed", out)
        self.assertIn("[FAIL]", out)
        with self.assertRaises(ClearHotError):
            reg.approve_and_promote(c3, "tester-1", "", c3)
        self.assertEqual(run_cli("reject", "--registry", reg_dir, "--id", c3, "--reviewer", "tester-1", "--note", "failed gates")[0], 0)
        self.assertEqual(reg.record(c3)["status"], "rejected")
        self.assertEqual(reg.active()[0], c2)
        # ---- rollback and restart restore the exact previous model
        self.assertEqual(run_cli("rollback", "--registry", reg_dir, "--reviewer", "tester-1", "--note", "demo")[0], 0)
        restarted = Registry(reg_dir)  # a fresh process would do exactly this
        aid, path = restarted.active()
        self.assertEqual(aid, c1)
        net, ck = load_checkpoint(path, expected_sha256=restarted.record(c1)["checkpoint_sha256"])
        self.assertEqual(weights_sha256(net), w1)
        # immutable checkpoint: modifying it after registration is detected and refused
        tmp_reg = Registry(E2E_DIR / "tamper_registry")
        tid = tmp_reg.register_candidate((reg_dir / "candidates" / c1 / "checkpoint.pt").read_bytes(), ck, simulated_demo=True)
        cp = E2E_DIR / "tamper_registry" / "candidates" / tid / "checkpoint.pt"
        os.chmod(cp, 0o644)
        with open(cp, "ab") as f:
            f.write(b"x")
        with self.assertRaises(ClearHotError):
            tmp_reg.checkpoint_path(tid)
        events = [json.loads(l)["event"] for l in (reg_dir / "events.jsonl").read_text().splitlines()]
        for ev in ("candidate_registered", "validated", "validation_failed", "approved_and_promoted", "rejected", "rollback"):
            self.assertIn(ev, events)
        # ---- gated final test
        code, _, err = run_cli("final-test", "--registry", reg_dir, "--dataset", ds2, "--id", c1, "--reviewer", "t", "--confirm-final-test", "yes")
        self.assertEqual(code, 1)
        self.assertFalse((reg_dir / "final_test_ledger.jsonl").exists())
        code, out, err = run_cli("final-test", "--registry", reg_dir, "--dataset", ds2, "--id", c1, "--reviewer", "t", "--confirm-final-test", "RUN FINAL TEST ONCE")
        self.assertEqual(code, 0, err)
        self.assertEqual(len((reg_dir / "final_test_ledger.jsonl").read_text().splitlines()), 1)
        # ---- inference cache for the viewer (restore the tampered checkpoint is impossible -> rebuild a clean copy of the registry state first)
        self._infer_part(reg_dir, c1)

    def _infer_part(self, reg_dir, c1):
        reg = Registry(reg_dir)
        rec = E2E_DIR / "recording.u16"
        self.assertEqual(run_cli("make-recording", "--out", rec, "--frames", 90, "--size", 64)[0], 0)
        cache = E2E_DIR / "cache"
        # unapproved model needs an explicit flag; active model is fine
        code, _, err = run_cli("infer", "--registry", reg_dir, "--source", rec, "--out", E2E_DIR / "cache_x", "--width", 64, "--height", 64, "--model",
                               [r for r in reg.list() if r["status"] == "rejected"][0]["id"])
        self.assertEqual(code, 1)
        self.assertIn("--allow-unapproved", err)
        code, _, err = run_cli("infer", "--registry", reg_dir, "--source", rec, "--out", cache, "--width", 64, "--height", 64)
        self.assertEqual(code, 1)  # no --yes and no TTY: refuses to write without consent
        self.assertIn("consent", err)
        self.assertFalse(cache.exists())
        code, out, err = run_cli("infer", "--registry", reg_dir, "--source", rec, "--out", cache, "--width", 64, "--height", 64, "--yes")
        self.assertEqual(code, 0, err)
        man = json.loads((cache / "manifest.json").read_text())
        self.assertEqual(man["source"]["sha256"], sha256_file(rec))
        self.assertEqual(man["frames"]["sourceTotal"], 90)
        self.assertEqual(man["model"]["id"], c1)
        self.assertTrue(man["model"]["approved"])
        self.assertEqual((cache / "frames.u16").stat().st_size, 90 * 64 * 64 * 2)
        self.assertEqual(sha256_file(cache / "frames.u16"), man["cache"]["sha256"])
        # frame 75 (beyond 60) in the cache equals a fresh inference of source frame 75 with the same weights
        net, _ = load_checkpoint(reg.checkpoint_path(c1))
        src = np.fromfile(rec, dtype="<u2").reshape(90, 64, 64)
        cached = np.fromfile(cache / "frames.u16", dtype="<u2").reshape(90, 64, 64)
        self.assertTrue(np.array_equal(cached[75], np.clip(np.rint(predict_counts(net, src[75])), 0, 16383).astype("<u2")))
        self.assertFalse(np.array_equal(cached[75], src[75]))
        code, _, err = run_cli("infer", "--registry", reg_dir, "--source", rec, "--out", cache, "--width", 64, "--height", 64, "--yes")
        self.assertEqual(code, 1)  # never overwrites
        code, _, err = run_cli("infer", "--registry", reg_dir, "--source", rec, "--out", E2E_DIR / "c2", "--width", 64, "--height", 64, "--start", 5, "--end", 200, "--yes")
        self.assertEqual(code, 1)  # range validation
        # no active model -> cache refused
        empty = Registry(E2E_DIR / "empty_registry")
        with self.assertRaises(ClearHotError):
            build_cache(empty, rec, E2E_DIR / "c3", {"width": 64, "height": 64, "header_bytes": 0, "shift": 0, "little_endian": True, "bits": 14}, yes=True, log=lambda *_: None)


class PrivacyTests(unittest.TestCase):
    def test_no_network_primitives_in_package_and_no_socket_use(self):
        src = "\n".join(p.read_text() for p in (ROOT / "training" / "clearhot_cnn").glob("*.py"))
        for needle in ("import socket", "urllib", "http.client", "import requests", "urlopen", "ftplib", "smtplib", "websocket"):
            self.assertNotIn(needle, src, needle)
        calls = []
        orig = socket.socket.connect
        socket.socket.connect = lambda self, *a, **k: calls.append(a) or (_ for _ in ()).throw(AssertionError("network connect attempted"))
        try:
            with tempfile.TemporaryDirectory() as td:
                run_cli("make-synth", "--out", Path(td) / "d", "--train-seeds", "0", "--val-seeds", "1", "--test-seeds", "2", "--frames", 2)
                self.assertEqual(run_cli("validate-data", Path(td) / "d")[0], 0)
        finally:
            socket.socket.connect = orig
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
