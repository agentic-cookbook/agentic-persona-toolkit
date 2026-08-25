#!/usr/bin/env python3
"""No file in this public repo may name a private package or the product it came from.

The eight UI packages arriving here were extracted from a PRIVATE repo, and each
one arrives carrying whatever prose its old home had written about it. A README
whose first line is `# @agentic-toolkit/model` is an install instruction for a
package the reader cannot fetch, published under an Apache-2.0 licence that says
they may.

The per-package arrival checks scan `src/` only, which is where the imports are —
and imports are not where this leaks. It leaks in README.md, in CHANGELOG.md, in
a doc comment at the top of a config file: the files nobody greps because they do
not compile. This guard scans the whole tree.

Two patterns, for two different failures:

  @agentic-toolkit/   a private package name. Fatal wherever it appears, including
                      in prose about a package that no longer exists — a public
                      repo should not be publishing another repo's history.
  agenticdeveloperhub the product these packages were built for. The toolkit is
                      meant to be usable by anyone; a reference to the one product
                      it happens to serve is either a leak or a coupling, and both
                      are worth seeing.

Exit 0 clean, 1 on a hit, 2 if there was nothing to scan — an empty scan is a
broken path, never a pass.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

PATTERNS = {
    "private package scope": re.compile(r"@agentic-toolkit/"),
    "product name": re.compile(r"agenticdeveloperhub", re.IGNORECASE),
}

SKIP_DIRS = {"node_modules", "dist", ".turbo", ".git", "coverage"}

# Binary and lockfile noise: a lockfile legitimately names whatever the manifests
# name, and is regenerated rather than edited, so it is not where a leak is fixed.
SKIP_NAMES = {"pnpm-lock.yaml", "package-lock.json", "yarn.lock"}
SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".pdf", ".zip", ".gz", ".map",
}


def scan(root: Path) -> tuple[list[str], int]:
    hits: list[str] = []
    scanned = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_NAMES or path.suffix.lower() in SKIP_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        scanned += 1
        for lineno, line in enumerate(text.splitlines(), start=1):
            for label, pattern in PATTERNS.items():
                if pattern.search(line):
                    rel = path.relative_to(root)
                    hits.append(f"{rel}:{lineno}: {label}: {line.strip()}")
    return hits, scanned


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "root",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "packages" / "web" / "packages",
        help="tree to scan (default: every web package)",
    )
    args = parser.parse_args()

    if not args.root.exists():
        print(f"check_no_private_scope: no such path: {args.root}", file=sys.stderr)
        return 2

    hits, scanned = scan(args.root)

    if scanned == 0:
        print(f"check_no_private_scope: nothing to scan under {args.root}", file=sys.stderr)
        return 2

    if hits:
        print(f"check_no_private_scope: {len(hits)} leak(s) in {scanned} files:\n", file=sys.stderr)
        for hit in hits:
            print(f"  {hit}", file=sys.stderr)
        print(
            "\nThis repo is public. A private package name here is an install "
            "instruction the reader cannot follow.",
            file=sys.stderr,
        )
        return 1

    print(f"check_no_private_scope: {scanned} files, no private references")
    return 0


if __name__ == "__main__":
    sys.exit(main())
