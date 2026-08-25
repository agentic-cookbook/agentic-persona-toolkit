#!/usr/bin/env python3
"""Self-test for check_license_fields: a guard whose failing case has rotted is worse than no guard."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

GUARD = Path(__file__).resolve().parent / "check_license_fields.py"


def run(root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(GUARD), "--root", str(root)],
        capture_output=True,
        text=True,
    )


def write_pkg(path: Path, license_value: str) -> None:
    path.mkdir(parents=True, exist_ok=True)
    (path / "package.json").write_text(
        json.dumps({"name": path.name, "license": license_value}), encoding="utf-8"
    )


def test_clean_tree_passes() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_pkg(root, "Apache-2.0")
        write_pkg(root / "packages" / "alpha", "Apache-2.0")
        result = run(root)
        assert result.returncode == 0, result.stdout + result.stderr


def test_unlicensed_package_fails() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_pkg(root, "Apache-2.0")
        write_pkg(root / "packages" / "alpha", "UNLICENSED")
        result = run(root)
        assert result.returncode == 1, "guard passed a UNLICENSED package"
        assert "alpha" in result.stdout + result.stderr


def test_empty_tree_is_an_error_not_a_pass() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        result = run(Path(tmp))
        assert result.returncode == 2, "an empty scan must fail loudly, not pass vacuously"


if __name__ == "__main__":
    test_clean_tree_passes()
    test_unlicensed_package_fails()
    test_empty_tree_is_an_error_not_a_pass()
    print("check_license_fields_test: 3 passed")
