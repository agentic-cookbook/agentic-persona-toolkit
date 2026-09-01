import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Where olylo's character config lives — the fixture every behavioural test
 *  loads, and the reason for the `@character` alias below.
 *
 *  It sits in a DIFFERENT repo (`whatsnow-toolkit`) that this one is checked out
 *  inside of, and in the olylo superproject this repo is checked out TWICE, at
 *  two different depths: once for the web app (nested under
 *  `whatsnow-toolkit/packages/web/external/`) and once for the Apple app (a
 *  sibling at the superproject root). A fixed run of `..` segments is therefore
 *  correct in exactly one of the two and resolves to a directory that does not
 *  exist in the other — which fails ten test files with nothing but "Cannot find
 *  package '@character/character.json'", and looks for all the world like a
 *  broken source tree. Searching upward is correct in both, and throws with the
 *  path it searched from when it is in neither. */
function findCharacterDir(): string {
  // Either this IS the toolkit repo's own tree, or the toolkit is a submodule
  // of the superproject we are somewhere underneath.
  const candidates = ["characters/olylo", "external/whatsnow-toolkit/characters/olylo"];
  const from = dirname(fileURLToPath(import.meta.url));
  let dir = from;
  for (;;) {
    for (const rel of candidates) {
      const found = resolve(dir, rel);
      // Probe a FILE, not the directory: an empty or half-initialised submodule
      // checkout still has the directory, and would resolve the alias to a tree
      // with no JSON in it — a later, much more confusing failure.
      if (existsSync(join(found, "character.json"))) return found;
    }
    const up = dirname(dir);
    if (up === dir) {
      throw new Error(`avatar-engine: no characters/olylo in any ancestor of ${from}`);
    }
    dir = up;
  }
}

const CHARACTER_DIR = findCharacterDir();

export default defineConfig({
  // `CHARACTER_DIR` is the same resolved path as the `@character` alias, handed
  // to the tests as a STRING: the goldens sit beside the JSON in that directory
  // and are read as files, not imported as modules, so an alias cannot reach
  // them. Resolved once, here, so the upward search above stays the single
  // source of truth for where olylo's config lives.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { CHARACTER_DIR },
  },
  resolve: {
    alias: {
      "@character": CHARACTER_DIR,
    },
  },
});
