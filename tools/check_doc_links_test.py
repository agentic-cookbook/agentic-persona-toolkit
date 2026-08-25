#!/usr/bin/env python3
"""Self-test for the doc-link resolve-check. Proves the failure path, not just the happy one."""
import subprocess
import sys
import tempfile
from pathlib import Path

GUARD = Path(__file__).resolve().parent / "check_doc_links.py"


def run(root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(GUARD), "--root", str(root)],
        capture_output=True, text=True,
    )


def check(label: str, got, want) -> None:
    if got != want:
        print(f"FAIL {label}: got {got!r}, want {want!r}", file=sys.stderr)
        sys.exit(1)


with tempfile.TemporaryDirectory() as tmp:
    # (1) A citation that resolves is silent.
    root = Path(tmp) / "ok"
    (root / "docs").mkdir(parents=True)
    (root / "docs" / "guide.md").write_text("hello\n")
    (root / "src.ts").write_text("// see docs/guide.md for why\n")
    check("resolving citation exits 0", run(root).returncode, 0)

    # (2) A citation that does not resolve fails, and names both ends.
    root = Path(tmp) / "dangling"
    (root / "docs").mkdir(parents=True)
    (root / "docs" / "guide.md").write_text("hello\n")
    (root / "src.ts").write_text("// see docs/gone.md for why\n")
    bad = run(root)
    check("dangling citation exits 1", bad.returncode, 1)
    check("names the cited path", "docs/gone.md" in bad.stdout + bad.stderr, True)
    check("names the citing site", "src.ts:1" in bad.stdout + bad.stderr, True)

    # (3) A relative citation is NOT a repo-relative one — it resolves against the
    #     citing file, so this check must not claim jurisdiction over it.
    root = Path(tmp) / "relative"
    (root / "docs").mkdir(parents=True)
    (root / "src.ts").write_text("// see ./docs/gone.md and ../docs/gone.md\n")
    check("relative paths ignored", run(root).returncode, 0)

    # (4) An empty scan is exit 2, not success. A guard that silently matches nothing
    #     is indistinguishable from a guard that passed, which is how they die.
    root = Path(tmp) / "empty"
    root.mkdir()
    check("empty scan exits 2", run(root).returncode, 2)

    # (5) A recipe corpus URI citation that resolves is silent.
    root = Path(tmp) / "uri-ok"
    (root / "recipes").mkdir(parents=True)
    (root / "recipes" / "button.md").write_text("hello\n")
    (root / "recipes" / "dialog.md").write_text(
        "---\nrelated:\n- agenticdeveloperhub://recipes/button\n---\n"
    )
    check("resolving recipe URI exits 0", run(root).returncode, 0)

    # (6) A recipe corpus URI citation that does not resolve fails, and names the
    #     offending slug.
    root = Path(tmp) / "uri-dangling"
    (root / "recipes").mkdir(parents=True)
    (root / "recipes" / "dialog.md").write_text(
        "---\nrelated:\n- agenticdeveloperhub://recipes/send-invitation-modal\n---\n"
    )
    bad = run(root)
    check("dangling recipe URI exits 1", bad.returncode, 1)
    check(
        "names the offending slug",
        "recipes/send-invitation-modal.md" in bad.stdout + bad.stderr,
        True,
    )

print("check_doc_links_test: 6 passed")
