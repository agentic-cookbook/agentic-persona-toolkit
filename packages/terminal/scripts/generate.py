#!/usr/bin/env python3
"""Generate the typed Python API client into src/apt_terminal/generated/.

Wraps `openapi-python-client` (httpx + pydantic v2). Driven by the consolidated
orchestrator (tools/codegen/generate.py), which passes --spec; runnable
standalone with an explicit --spec path.

Usage:
  python3 scripts/generate.py --spec /abs/path/to/openapi.json
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "openapi-python-client-config.yaml"
OUT_PARENT = ROOT / "src" / "apt_terminal"
OUT = OUT_PARENT / "generated"


def interpreter() -> str:
    """The python that has `openapi-python-client` installed.

    pyproject pins the generator in the `dev` extra, so the interpreter that can run it is
    normally this package's own `.venv` — not whatever python the consolidated orchestrator
    happened to start with (it invokes us as a bare `python3`). Prefer the local venv when
    it exists so `pnpm gen` works from a clean checkout after `pip install -e '.[dev]'`,
    and fall back to the running interpreter for anyone who installed the extra globally.
    """
    venv = ROOT / ".venv" / "bin" / "python"
    return str(venv) if venv.exists() else sys.executable


def build_cmd(spec: Path) -> list[str]:
    return [
        interpreter(), "-m", "openapi_python_client", "generate",
        "--path", str(spec),
        "--meta", "none",
        "--output-path", str(OUT),
        "--overwrite",
        "--config", str(CONFIG),
    ]


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--spec", required=True, help="path to the OpenAPI spec")
    args = p.parse_args(argv)
    spec = Path(args.spec)
    if not spec.exists():
        print(f"error: missing spec {spec}", file=sys.stderr)
        return 1
    # --overwrite replaces OUT; ensure a clean parent dir exists.
    OUT_PARENT.mkdir(parents=True, exist_ok=True)
    print(f"$ {' '.join(build_cmd(spec))}")
    subprocess.run(build_cmd(spec), check=True)
    print(f"generated client at {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
