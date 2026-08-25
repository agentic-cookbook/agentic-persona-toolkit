#!/usr/bin/env python3
"""copy-css must MIRROR, not merely copy: a dist stylesheet with no src counterpart is deleted.

Left behind, an orphan keeps resolving here and breaks in a fresh checkout, which is
the worst shape a bug can take.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "copy-css.mjs"


def test_orphan_is_pruned() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pkg = Path(tmp)
        (pkg / "src").mkdir()
        (pkg / "dist").mkdir()
        (pkg / "src" / "kept.css").write_text("a{}", encoding="utf-8")
        (pkg / "dist" / "kept.css").write_text("stale", encoding="utf-8")
        (pkg / "dist" / "orphan.css").write_text("b{}", encoding="utf-8")

        result = subprocess.run(
            ["node", str(SCRIPT)], cwd=pkg, capture_output=True, text=True
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert (pkg / "dist" / "kept.css").read_text(encoding="utf-8") == "a{}"
        assert not (pkg / "dist" / "orphan.css").exists(), "orphan survived the mirror"


def test_src_and_dest_flags() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pkg = Path(tmp)
        (pkg / "styles").mkdir()
        (pkg / "styles" / "one.css").write_text("c{}", encoding="utf-8")

        result = subprocess.run(
            ["node", str(SCRIPT), "--src", "styles", "--dest", "out/css"],
            cwd=pkg,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert (pkg / "out" / "css" / "one.css").read_text(encoding="utf-8") == "c{}"


if __name__ == "__main__":
    test_orphan_is_pruned()
    test_src_and_dest_flags()
    print("copy_css_orphan_test: 2 passed")
