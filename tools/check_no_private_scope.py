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
not compile.

This guard scans four directories, not the repo root: `packages/web/packages`
(the library — the packages that arrived from the private repo), `recipes` and
`docs` (the prose that describes them), and `websites` (the demo sites, which
ship too). Nowhere else. The true repo root was tried and rejected: ADT's Apple
and terminal trees legitimately reference `api.agenticdeveloperhub.com` as a real
service endpoint, and this file's own source and self-test contain every pattern
they exist to detect — a root that floods with expected hits is a guard nobody
reads past. These four are exactly the trees that hold shipped prose and shipped
code and nothing else that this guard can tell apart from a leak.

Three patterns, for three different failures:

  @agentic-toolkit/   a private package name. Fatal wherever it appears, including
                      in prose about a package that no longer exists — a public
                      repo should not be publishing another repo's history.
  agenticdeveloperhub the product these packages were built for. The toolkit is
                      meant to be usable by anyone; a reference to the one product
                      it happens to serve is either a leak or a coupling, and both
                      are worth seeing.
  private repo paths  a filesystem path into a tree the reader does not have:
                      `backend/src/adh/src/lib/rdid.ts`,
                      `frontend/tools/verify_autofill_copies.py`,
                      `adh-site-config/content/help.en.json`.

That third pattern is deliberately about PATHS and not about the word "adh". Naming
adh as a service is correct and this repo does it in twenty-one places on purpose —
`chat` exists to talk to adh's API, and "adh's chat endpoint carries a message and
nothing else" is exactly what a consumer needs to read. A CSS class called
`adh-mv-prose` is this toolkit's public API; a theme called `adh-comic` is shipped
branding. None of those are leaks and none of them are matched here.

Widening into `recipes/` turned up one more shape like it: every recipe's frontmatter
carries a `domain: agenticdeveloperhub://recipes/<slug>` field (and the same scheme in
`ingredients:`/`related:` cross-references) — the artifact format's own internal URI
namespace for the recipe corpus, present identically in every recipe this repo already
shipped before this task, resolving nowhere and naming no coordinate. It is not a
leak in the sense this guard exists to catch, any more than `adh-mv-prose` is, so the
product-name pattern below carves out exactly that one scheme shape and nothing wider —
a bare `agenticdeveloperhub` anywhere else, including `agenticdeveloperhub.com` or
`api.agenticdeveloperhub.com`, still fires.

A path is different in kind. It cannot be followed by anyone outside the private
repo, so it is useless to the reader it is addressed to, and it describes a layout
they were not given. Several of the comments carrying such paths do record something
worth keeping — that two copies of a list are pinned against each other by a parity
guard, and that editing one alone will be caught. Keep the invariant, drop the
coordinate: "a parity guard in the consuming application asserts these two copies
stay identical" says the useful half and names nothing unreachable.

Exit 0 clean, 1 on a hit, 2 if there was nothing to scan, or if a named root does
not exist — an empty scan (and a missing root looks exactly like one) is a broken
path, never a pass.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOTS = ("packages/web/packages", "recipes", "docs", "websites")

PATTERNS = {
    "private package scope": re.compile(r"@agentic-toolkit/"),
    # (?!://recipes/) carves out the recipe corpus's own `agenticdeveloperhub://recipes/<slug>`
    # domain-URI scheme (see the docstring) — everything else still fires.
    "product name": re.compile(r"agenticdeveloperhub(?!://recipes/)", re.IGNORECASE),
    "private repo path": re.compile(
        r"backend/src/(adh|builder|status)"
        r"|frontend/(src|tools)/"
        r"|\badh/(src|frontend)/"
        r"|adh-site-config",
        re.IGNORECASE,
    ),
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
        "roots",
        nargs="*",
        type=Path,
        default=None,
        help=(
            "trees to scan (default: packages/web/packages, recipes, docs, "
            "websites). A single per-package path — e.g. "
            "packages/web/packages/<pkg> — still works unchanged."
        ),
    )
    args = parser.parse_args()

    roots = args.roots if args.roots else [REPO_ROOT / r for r in DEFAULT_ROOTS]

    all_hits: list[str] = []
    total_scanned = 0
    for root in roots:
        if not root.exists():
            print(f"check_no_private_scope: no such path: {root}", file=sys.stderr)
            return 2

        hits, scanned = scan(root)
        all_hits.extend(hits)
        total_scanned += scanned

    if total_scanned == 0:
        print(f"check_no_private_scope: nothing to scan under {roots}", file=sys.stderr)
        return 2

    if all_hits:
        print(f"check_no_private_scope: {len(all_hits)} leak(s) in {total_scanned} files:\n", file=sys.stderr)
        for hit in all_hits:
            print(f"  {hit}", file=sys.stderr)
        print(
            "\nThis repo is public. A private package name here is an install "
            "instruction the reader cannot follow.",
            file=sys.stderr,
        )
        return 1

    print(f"check_no_private_scope: {total_scanned} files, no private references")
    return 0


if __name__ == "__main__":
    sys.exit(main())
