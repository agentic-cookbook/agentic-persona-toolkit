#!/usr/bin/env python3
"""Every repo-relative `docs/…md` or `recipes/…md` citation in this repo must resolve.

The scope guard is a denylist and knows the private scope's name; this is the complement.
It asks only whether a reader following the citation lands on a file, which is the property
that actually matters and the one that survives the private repo being renamed.

Exit 0 clean, 1 dangling citations found, 2 nothing scanned.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# A repo-relative doc path. The lookbehind rejects `./docs/x.md` and `../docs/x.md`
# (relative to the citing file, so not ours to resolve) and `https://…/docs/x.md`.
CITATION = re.compile(r"(?<![./\w-])((?:docs|recipes)/[\w./-]+\.md)\b")
SKIP_DIRS = {"node_modules", "dist", ".turbo", ".git", "coverage", ".next"}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".svg", ".woff2", ".map", ".lock"}
SKIP_NAMES = {"pnpm-lock.yaml", "package-lock.json"}
# The resolve-check's own self-test writes synthetic doc citations into temp
# dirs to prove the pass/fail paths, but those same literal fixture strings
# sit in the self-test's own source, and a repo-root scan (this guard's
# default) walks tools/ same as everything else. Skip that one file rather
# than the strings inside it: they are proof-of-behavior, not a citation
# into this repo.
SKIP_NAMES |= {"check_doc_links_test.py"}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args()
    root = Path(args.root).resolve()

    hits: dict[str, list[str]] = {}
    scanned = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() in SKIP_SUFFIXES:
            continue
        rel = path.relative_to(root)
        if SKIP_DIRS & set(rel.parts) or path.name in SKIP_NAMES:
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (UnicodeDecodeError, OSError):
            continue
        scanned += 1
        for i, line in enumerate(lines, 1):
            for m in CITATION.finditer(line):
                cited = m.group(1)
                if not (root / cited).exists():
                    hits.setdefault(cited, []).append(f"{rel}:{i}")

    if scanned == 0:
        print(f"check_doc_links: scanned NOTHING under {root} — wrong root, or the "
              f"skip list ate the tree. Not a pass.", file=sys.stderr)
        sys.exit(2)

    if hits:
        for cited, where in sorted(hits.items(), key=lambda kv: -len(kv[1])):
            print(f"{cited} does not exist here ({len(where)} citation(s)):", file=sys.stderr)
            for w in where:
                print(f"    {w}", file=sys.stderr)
        print(f"\ncheck_doc_links: {len(hits)} dangling doc path(s) over {scanned} files. "
              f"Either bring the file, or drop the coordinate and keep the claim.",
              file=sys.stderr)
        sys.exit(1)

    print(f"check_doc_links: OK — every citation resolves ({scanned} files scanned)")


if __name__ == "__main__":
    main()
