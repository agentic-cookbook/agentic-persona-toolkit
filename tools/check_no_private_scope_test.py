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


def test_private_repo_path_is_caught() -> None:
    """A comment giving coordinates into a repo the reader does not have."""
    cases = [
        "// A MIRROR of backend/src/adh/src/lib/rdid.ts, pinned by a parity guard.\n",
        "// `frontend/tools/verify_autofill_copies.py` is what holds the copies together.\n",
        "/* Route-keyed, over adh-site-config/content/help.en.json. */\n",
        "// NOT adh/src/help/store.ts, which is easy to mistake this for.\n",
    ]
    for source in cases:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "src" / "thing.ts").write_text(source, encoding="utf-8")
            result = run(root)
            assert result.returncode == 1, f"path survived the guard: {source!r}"
            assert "private repo path" in result.stderr, result.stderr


def test_naming_adh_as_a_service_is_not_a_leak() -> None:
    """The narrow half of the rule, and the reason the pattern is about paths.

    `chat` exists to talk to adh's API and says so in twenty-one places. A CSS class
    is public API; a theme name is branding; a fixture is sample data. A guard that
    fired on these would be turned off within a week, and it would deserve to be.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "src" / "backend.ts").write_text(
            "// adh's chat endpoint carries a message and nothing else.\n"
            "const cls = 'adh-mv-prose'\n"
            "const theme = 'adh-comic'\n"
            "const fixture = { orgSlug: 'adh', badge: 'ADH-42' }\n",
            encoding="utf-8",
        )
        result = run(root)
        assert result.returncode == 0, f"false positive on legitimate adh prose: {result.stderr}"


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
