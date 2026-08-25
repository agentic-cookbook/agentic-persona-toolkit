#!/usr/bin/env python3
"""Every package.json in this repo declares Apache-2.0.

A public repo with `UNLICENSED` in its manifests grants nobody any rights, which is
the exact failure this repo existed in before 2026-08. Exit 2 on an empty scan: a
guard that finds nothing must not report success.
"""
import argparse
import json
import sys
from pathlib import Path

EXPECTED = "Apache-2.0"
SKIP_DIRS = {"node_modules", "dist", ".git"}


def manifests(root: Path):
    for path in sorted(root.rglob("package.json")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    if not args.root.is_dir():
        print(f"error: root not found: {args.root}", file=sys.stderr)
        return 2

    found = 0
    violations = []
    for path in manifests(args.root):
        found += 1
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as err:
            print(f"error: {path}: {err}", file=sys.stderr)
            return 2
        if data.get("license") != EXPECTED:
            violations.append((path, data.get("license")))

    if found == 0:
        print(f"error: no package.json found under {args.root}", file=sys.stderr)
        return 2

    for path, actual in violations:
        print(f"{path}: license is {actual!r}, expected {EXPECTED!r}", file=sys.stderr)

    if violations:
        print(f"{len(violations)} of {found} manifests wrong", file=sys.stderr)
        return 1

    print(f"check_license_fields: {found} manifests, all {EXPECTED}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
