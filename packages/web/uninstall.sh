#!/usr/bin/env bash
#
# Remove the shadcn primitives an install GENERATED into packages/ui — and nothing
# else.
#
# This script used to delete every depth-1 `.ts`/`.tsx` under
# `packages/ui/src/components`, plus `packages/ui/src/lib/utils.ts`, unconditionally.
# That was safe exactly as long as none of those files were tracked: `packages/ui`
# held a components directory that git knew nothing about, so "everything here is
# generated" and "everything here is deletable" were the same statement.
#
# They are not the same statement any more. The ui package now ships its components
# as tracked source, so the unconditional `find … -delete` destroys checked-in files
# and there is nothing in the script that would notice. The fix is to stop inferring
# "generated" from a location and ask the one authority that actually knows: git.
# Tracked file => leave it, always, no matter what it is called or where it sits.
#
# Invariant this guarantees: after `install.sh` then `uninstall.sh`, `git status
# --porcelain` is empty and no tracked file is missing.
#
# (Shell rather than Python on purpose — `install`/`uninstall`/`setup` are the three
# entry points that stay shell.)
set -euo pipefail
cd "$(dirname "$0")"

# No git, no way to tell generated from tracked — so refuse rather than guess. A
# delete that cannot be justified is not one to perform "just in case".
if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: uninstall.sh needs a git checkout to tell generated files from" >&2
  echo "       tracked source. Nothing was deleted." >&2
  exit 1
fi

echo "==> Removing shadcn-generated primitives"

# `--others` = untracked, i.e. generated. Deliberately WITHOUT `--exclude-standard`:
# a generated primitive that a .gitignore also covers is still generated, and still
# ours to remove. `:(glob)` makes `*` stop at a `/`, so this stays depth-1 under
# `components/` exactly as the old `-maxdepth 1` did.
#
# A counter rather than an array: bash 3.2 (macOS's /bin/bash) treats `${#arr[@]}`
# on an EMPTY array as an unbound variable under `set -u`, which would abort the
# script on the one outcome that is completely normal — a tree with nothing
# generated in it.
removed=0
while IFS= read -r -d '' file; do
  echo "    rm $file"
  rm -f -- "$file"
  removed=$((removed + 1))
done < <(git ls-files --others -z -- \
  ':(glob)packages/ui/src/components/*.ts' \
  ':(glob)packages/ui/src/components/*.tsx' \
  ':(glob)packages/ui/src/lib/utils.ts')

if [ "$removed" -eq 0 ]; then
  echo "    nothing generated to remove (every candidate file is tracked source)"
fi

cat <<'EOF'

Generated primitives removed. Tracked source and committed configuration are left
intact — including anything under packages/ui/src/components that git tracks:
  - packages/ui/components.json
  - packages/ui/src/styles/globals.css
  - exports map and shadcn deps in packages/ui/package.json

Re-run install.sh + shadcn add to repopulate.
EOF
