"""Bridge to the ORIGINAL classical engines (TypeScript, run by Node) so evaluation compares against real Argos 2."""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from .common import ClearHotError, sha256_file

ROOT = Path(__file__).resolve().parents[2]  # .../clearhot
ARGOS2_ENGINE = ROOT / "src" / "argos" / "thermalPipelineEngine.ts"
ARCHIVED_ENGINE_SHA256 = "c9ab6e860ac069af19dd3d80498761f4133aa30b1345a8f76e1af8db789cb072"  # from provenance/reference_submissions/thermalimageargos.zip


def engine_provenance() -> dict:
    sha = sha256_file(ARGOS2_ENGINE)
    return {"engine_file": "src/argos/thermalPipelineEngine.ts", "sha256": sha, "archived_original_sha256": ARCHIVED_ENGINE_SHA256,
            "byte_identical_to_archived_original": sha == ARCHIVED_ENGINE_SHA256}


def run_classical(frames: np.ndarray, seq_lengths: list, method: str = "argos2") -> dict:
    """frames uint16 [N,H,W] (14-bit counts). Returns restored float32 counts [N,H,W], native uint8 [N,H,W], ms/frame."""
    node = shutil.which("node")
    if not node:
        raise ClearHotError("Node.js is required to run the original Argos 2 baseline (install Node 20+). Evaluation cannot silently skip it.")
    if not (ROOT / "tests" / "core.cjs").exists():
        raise ClearHotError("tests/core.cjs missing: run `npm run build` in the project root first")
    N, H, W = frames.shape
    with tempfile.TemporaryDirectory() as td:
        inp, pre = Path(td) / "in.u16", str(Path(td) / "out")
        inp.write_bytes(np.ascontiguousarray(frames.astype("<u2")).tobytes())
        r = subprocess.run([node, str(ROOT / "tools" / "baseline.mjs"), "--in", str(inp), "--width", str(W), "--height", str(H), "--method", method,
                            "--seq-lengths", ",".join(map(str, seq_lengths)), "--out-prefix", pre], capture_output=True, text=True, timeout=1800)
        if r.returncode != 0:
            raise ClearHotError(f"classical baseline failed: {r.stderr.strip()[:500]}")
        meta = json.loads(Path(pre + ".json").read_text())
        restored = np.frombuffer(Path(pre + ".restored.f32").read_bytes(), dtype="<f4").reshape(N, H, W).copy()
        native = np.frombuffer(Path(pre + ".native.u8").read_bytes(), dtype=np.uint8).reshape(N, H, W).copy()
    if not np.isfinite(restored).all():
        raise ClearHotError("classical baseline produced non-finite values")
    return {"restored": restored, "native": native, "ms_per_frame": meta["msPerFrame"], "meta": meta}
