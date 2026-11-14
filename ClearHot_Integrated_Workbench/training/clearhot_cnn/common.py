"""Shared helpers: hashing, atomic writes, environment/code provenance."""
from __future__ import annotations

import hashlib
import json
import os
import platform
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

PKG_DIR = Path(__file__).resolve().parent


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(path, chunk: int = 1 << 22, progress=None) -> str:
    """Streaming FULL-file SHA-256 (never a sampled fingerprint)."""
    h = hashlib.sha256()
    size = os.path.getsize(path)
    done = 0
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
            done += len(b)
            if progress:
                progress(done, size)
    return h.hexdigest()


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def json_sha256(obj) -> str:
    return sha256_bytes(canonical_json(obj).encode("utf-8"))


def atomic_write_bytes(path, data: bytes) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=path.suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)  # atomic on POSIX
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def atomic_write_json(path, obj) -> None:
    atomic_write_bytes(path, (json.dumps(obj, indent=2, sort_keys=True) + "\n").encode("utf-8"))


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def code_sha256() -> str:
    """Hash of every .py file in this package (sorted by name)."""
    h = hashlib.sha256()
    for p in sorted(PKG_DIR.glob("*.py")):
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()


def environment_info() -> dict:
    info = {"python": sys.version.split()[0], "platform": platform.platform(), "machine": platform.machine()}
    try:
        import numpy

        info["numpy"] = numpy.__version__
    except Exception:  # pragma: no cover
        pass
    try:
        import torch

        info["torch"] = str(torch.__version__)
        info["mps_available"] = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        info["cuda_available"] = bool(torch.cuda.is_available())
    except Exception:  # pragma: no cover
        info["torch"] = None
    return info


class ClearHotError(Exception):
    """User-visible failure. The CLI prints it and exits non-zero; nothing is claimed as success."""
