"""Local model registry: candidate -> validated -> (human approval) -> active, with immutable checkpoint IDs, an
append-only event log, atomic promotion and rollback. State is read from disk each time, so a restart restores the exact
active model. Nothing here ever promotes automatically."""
from __future__ import annotations

import json
import os
from pathlib import Path

from .common import ClearHotError, atomic_write_bytes, atomic_write_json, json_sha256, read_json, sha256_bytes, sha256_file, utc_now
from .evaluate import report_csv

STATUSES = ("candidate", "validated", "validation_failed", "rejected", "active", "retired", "rolled_back")


class Registry:
    def __init__(self, root):
        self.root = Path(root)
        (self.root / "candidates").mkdir(parents=True, exist_ok=True)
        if not (self.root / "state.json").exists():
            atomic_write_json(self.root / "state.json", {"schema": "clearhot-registry-v1", "active": None, "stack": []})

    # ---- persistence helpers
    def _state(self) -> dict:
        return read_json(self.root / "state.json")

    def _event(self, kind: str, cid, **kw) -> None:
        line = json.dumps({"time": utc_now(), "event": kind, "id": cid, **kw}, sort_keys=True) + "\n"
        with open(self.root / "events.jsonl", "a", encoding="utf-8") as f:
            f.write(line)
            f.flush()
            os.fsync(f.fileno())

    def _dir(self, cid: str) -> Path:
        if not cid or "/" in cid or ".." in cid:
            raise ClearHotError("invalid id")
        d = self.root / "candidates" / cid
        if not d.is_dir():
            raise ClearHotError(f"unknown checkpoint id {cid}")
        return d

    def record(self, cid: str) -> dict:
        return read_json(self._dir(cid) / "record.json")

    def _save(self, cid: str, rec: dict) -> None:
        atomic_write_json(self._dir(cid) / "record.json", rec)

    def checkpoint_path(self, cid: str) -> Path:
        """Verified path: the immutable file must still match the hash recorded at registration."""
        rec = self.record(cid)
        p = self._dir(cid) / "checkpoint.pt"
        if sha256_file(p) != rec["checkpoint_sha256"]:
            raise ClearHotError(f"checkpoint {cid} was modified after registration; refusing to use it")
        return p

    # ---- lifecycle
    def register_candidate(self, ckpt_bytes: bytes, info: dict, simulated_demo: bool = False, note: str = "") -> str:
        sha = sha256_bytes(ckpt_bytes)
        cid = "ckpt-" + sha[:12]
        d = self.root / "candidates" / cid
        if d.exists():
            raise ClearHotError(f"{cid} already registered (identical checkpoint bytes); checkpoints are immutable")
        d.mkdir(parents=True)
        atomic_write_bytes(d / "checkpoint.pt", ckpt_bytes)
        os.chmod(d / "checkpoint.pt", 0o444)
        rec = {"schema": "clearhot-model-record-v1", "id": cid, "status": "candidate", "created": utc_now(), "checkpoint_sha256": sha,
               "weights_sha256": info["weights_sha256"], "arch_sha256": info["arch_sha256"], "steps": info["steps"],
               "dataset": info["dataset"], "data_domain": info["dataset"]["domain"], "simulated_demo": bool(simulated_demo),
               "label": ("SIMULATED/DEMO · " if simulated_demo else "") + ("SYNTHETIC-DATA · " if info["dataset"]["domain"] == "SYNTHETIC" else "") + "candidate",
               "training_config": info["config"], "code_sha256": info["code_sha256"], "env": info["env"], "note": note,
               "validation": None, "approval": None, "rejection": None}
        atomic_write_json(d / "record.json", rec)
        self._event("candidate_registered", cid, simulated_demo=simulated_demo, dataset=info["dataset"]["version"])
        return cid

    def attach_validation(self, cid: str, report: dict) -> dict:
        rec = self.record(cid)
        if rec["status"] not in ("candidate", "validated", "validation_failed"):
            raise ClearHotError(f"{cid} is {rec['status']}; it cannot be re-validated")
        if report["split"] != "val":
            raise ClearHotError("only a validation-split report can gate promotion")
        d = self._dir(cid)
        atomic_write_json(d / "validation_report.json", report)
        atomic_write_bytes(d / "validation_report.csv", report_csv(report).encode())
        rec["validation"] = {"report_sha256": json_sha256(report), "all_mandatory_passed": report["all_mandatory_passed"],
                             "failed_gates": report["failed_gates"], "dataset_version": report["dataset"]["version"],
                             "gates_config_is_test_only": report["gates_config_is_test_only"], "time": report["created"]}
        rec["status"] = "validated" if report["all_mandatory_passed"] else "validation_failed"
        rec["label"] = rec["label"].rsplit("·", 1)[0] + "· " + ("validated (not approved)" if report["all_mandatory_passed"] else "FAILED validation")
        self._save(cid, rec)
        self._event("validated" if report["all_mandatory_passed"] else "validation_failed", cid, failed=report["failed_gates"])
        return rec

    def approve_and_promote(self, cid: str, reviewer: str, note: str, confirm: str) -> dict:
        """The ONLY path to 'active'. Needs an explicit human reviewer + typed confirmation equal to the id."""
        if not reviewer or len(reviewer.strip()) < 2:
            raise ClearHotError("a reviewer name/pseudonym is required")
        if confirm != cid:
            raise ClearHotError(f"explicit approval requires --confirm-approve {cid}")
        rec = self.record(cid)
        if rec["status"] != "validated" or not rec["validation"] or not rec["validation"]["all_mandatory_passed"]:
            raise ClearHotError(f"{cid} is '{rec['status']}': only a candidate that passed every mandatory gate can be approved (no override exists)")
        rep = read_json(self._dir(cid) / "validation_report.json")
        if json_sha256(rep) != rec["validation"]["report_sha256"]:
            raise ClearHotError("validation report was modified after it was recorded")
        self.checkpoint_path(cid)  # re-verify immutable hash
        st = self._state()
        prev = st["active"]
        rec["approval"] = {"reviewer": reviewer.strip(), "note": note, "time": utc_now(), "report_sha256": rec["validation"]["report_sha256"],
                           "previous_active": prev, "statement": "human explicitly approved after reviewing the validation report"}
        rec["status"] = "active"
        rec["label"] = rec["label"].rsplit("·", 1)[0] + "· APPROVED · active"
        if prev:
            pr = self.record(prev)
            pr["status"] = "retired"
            self._save(prev, pr)
        self._save(cid, rec)
        st["stack"].append(prev)
        st["active"] = cid
        atomic_write_json(self.root / "state.json", st)  # atomic pointer flip is the last step
        self._event("approved_and_promoted", cid, reviewer=reviewer.strip(), previous=prev)
        return rec

    def reject(self, cid: str, reviewer: str, note: str) -> dict:
        if not reviewer or len(reviewer.strip()) < 2:
            raise ClearHotError("a reviewer name/pseudonym is required")
        rec = self.record(cid)
        if rec["status"] == "active":
            raise ClearHotError("the active model cannot be rejected; roll back first")
        prev_status = rec["status"]
        rec["status"] = "rejected"
        rec["rejection"] = {"reviewer": reviewer.strip(), "note": note, "time": utc_now(), "previous_status": prev_status}
        rec["label"] = rec["label"].rsplit("·", 1)[0] + "· REJECTED"
        self._save(cid, rec)
        self._event("rejected", cid, reviewer=reviewer.strip(), note=note)
        return rec

    def rollback(self, reviewer: str, note: str) -> dict:
        st = self._state()
        if not st["stack"]:
            raise ClearHotError("nothing to roll back: no earlier active model state is recorded")
        if not reviewer or len(reviewer.strip()) < 2:
            raise ClearHotError("a reviewer name/pseudonym is required")
        cur, prev = st["active"], st["stack"][-1]
        if prev:
            self.checkpoint_path(prev)  # verify target before flipping
        if cur:
            cr = self.record(cur)
            cr["status"] = "rolled_back"
            cr["label"] = cr["label"].rsplit("·", 1)[0] + "· ROLLED BACK"
            self._save(cur, cr)
        if prev:
            pr = self.record(prev)
            pr["status"] = "active"
            self._save(prev, pr)
        st["stack"].pop()
        st["active"] = prev
        atomic_write_json(self.root / "state.json", st)
        self._event("rollback", cur, to=prev, reviewer=reviewer.strip(), note=note)
        return {"from": cur, "to": prev}

    def active(self):
        """(id, verified checkpoint path) or (None, None) meaning 'classical only'."""
        a = self._state()["active"]
        if not a:
            return None, None
        rec = self.record(a)
        val, approval = rec.get("validation"), rec.get("approval")
        if rec.get("status") != "active" or not val or not val.get("all_mandatory_passed") or not approval or approval.get("report_sha256") != val.get("report_sha256"):
            raise ClearHotError("active pointer is inconsistent with validated human approval; refusing model")
        report = read_json(self._dir(a) / "validation_report.json")
        if json_sha256(report) != val["report_sha256"]:
            raise ClearHotError("active validation report hash mismatch; refusing model")
        return a, self.checkpoint_path(a)

    def list(self) -> list:
        out = []
        for d in sorted((self.root / "candidates").iterdir()):
            if (d / "record.json").exists():
                out.append(read_json(d / "record.json"))
        out.sort(key=lambda r: r["created"])
        return out

    def log_final_test(self, cid: str, dataset_manifest_sha256: str, reviewer: str, report_sha256: str) -> int:
        led = self.root / "final_test_ledger.jsonl"
        n = 0
        if led.exists():
            n = sum(1 for _ in open(led, encoding="utf-8"))
        with open(led, "a", encoding="utf-8") as f:
            f.write(json.dumps({"time": utc_now(), "id": cid, "dataset_manifest_sha256": dataset_manifest_sha256, "reviewer": reviewer,
                                "report_sha256": report_sha256, "invocation_number": n + 1}, sort_keys=True) + "\n")
            f.flush()
            os.fsync(f.fileno())
        self._event("final_test_invoked", cid, invocation_number=n + 1)
        return n + 1
