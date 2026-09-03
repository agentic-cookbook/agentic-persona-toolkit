import { defineConfig } from "vitest/config";
import { findCharacterDir } from "./character-dir.ts";

/** Where the character config lives — the fixture every behavioural test loads,
 *  and the reason for the `@character` alias below. The search itself, why it
 *  is a search, and what it falls back to are documented in `character-dir.ts`.
 *  It is a module beside this file rather than a function inside it so that the
 *  search has tests of its own: a vitest config is loaded once, before any test
 *  runs, and whatever it decides is invisible to the suite it configures. */
const CHARACTER_DIR = findCharacterDir();

export default defineConfig({
  // `CHARACTER_DIR` is the same resolved path as the `@character` alias, handed
  // to the tests as a STRING: the goldens sit beside the JSON in that directory
  // and are read as files, not imported as modules, so an alias cannot reach
  // them. Resolved once, here, so the search stays the single source of truth
  // for where the character config lives.
  test: {
    environment: "node",
    // Ten scenarios totalling 93MB of frames, replayed from scratch in one
    // test. It fits inside vitest's 5s default when this package runs alone and
    // does not when it runs as one project of the workspace-wide root suite,
    // sharing the machine with two hundred other test files — where it timed
    // out at 7.1s. A recorder that is genuinely this slow needs a timeout that
    // says so, not a suite that passes depending on what else is running.
    testTimeout: 30_000,
    // The resolver's own tests sit BESIDE it at the package root rather than
    // under `src/`, because `src/` is the shipped library: `src/config/deps.test.ts`
    // rejects any non-test module there that imports `node:` anything, and a
    // module whose whole job is walking the filesystem imports `node:fs`.
    include: ["src/**/*.test.ts", "*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    env: { CHARACTER_DIR },
  },
  resolve: {
    alias: {
      "@character": CHARACTER_DIR,
    },
  },
});
