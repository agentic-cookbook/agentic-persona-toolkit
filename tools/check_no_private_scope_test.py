#!/usr/bin/env python3
"""Self-test: the private-scope guard must catch what the src-only greps missed.

Every case here is a real shape from the migration. The README case is the one
that motivated the guard — it passed eight src-scoped greps.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

GUARD = Path(__file__).resolve().parent / "check_no_private_scope.py"


def run(root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(GUARD), str(root)],
        capture_output=True,
        text=True,
    )


def test_clean_tree_passes() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "src" / "index.ts").write_text(
            "export { thing } from '@agenticdevelopertoolkit/model'\n", encoding="utf-8"
        )
        (root / "README.md").write_text("# @agenticdevelopertoolkit/model\n", encoding="utf-8")
        result = run(root)
        assert result.returncode == 0, f"clean tree rejected: {result.stderr}"


def test_readme_leak_is_caught() -> None:
    """The motivating case: prose outside src/, which no arrival grep looked at."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "src" / "index.ts").write_text("export const a = 1\n", encoding="utf-8")
        (root / "README.md").write_text("# @agentic-toolkit/model\n", encoding="utf-8")
        result = run(root)
        assert result.returncode == 1, "README leak survived the guard"
        assert "README.md:1" in result.stderr, result.stderr


def test_product_name_is_caught() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "src" / "site.ts").write_text(
            "// built for agenticdeveloperhub\n", encoding="utf-8"
        )
        result = run(root)
        assert result.returncode == 1, "product name survived the guard"
        assert "product name" in result.stderr, result.stderr


def test_node_modules_and_lockfiles_are_skipped() -> None:
    """A vendored dep naming the private scope is not this repo's leak to fix."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "node_modules" / "dep").mkdir(parents=True)
        (root / "node_modules" / "dep" / "index.js").write_text(
            "require('@agentic-toolkit/ui')\n", encoding="utf-8"
        )
        (root / "dist").mkdir()
        (root / "dist" / "index.js").write_text("'@agentic-toolkit/ui'\n", encoding="utf-8")
        (root / "pnpm-lock.yaml").write_text("'@agentic-toolkit/ui':\n", encoding="utf-8")
        (root / "src").mkdir()
        (root / "src" / "index.ts").write_text("export const a = 1\n", encoding="utf-8")
        result = run(root)
        assert result.returncode == 0, f"skipped trees were scanned: {result.stderr}"


def test_empty_scan_is_not_a_pass() -> None:
    """A guard that greens on a wrong path is worse than no guard."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "nope"
        result = run(root)
        assert result.returncode == 2, f"missing path returned {result.returncode}"

        empty = Path(tmp) / "empty"
        empty.mkdir()
        result = run(empty)
        assert result.returncode == 2, f"empty tree returned {result.returncode}"


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for test in tests:
        test()
    print(f"check_no_private_scope_test: {len(tests)} passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
