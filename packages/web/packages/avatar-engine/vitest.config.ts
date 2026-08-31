import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: {
    alias: {
      // olylo's config is the fixture every behavioural test loads, and it lives
      // in a different repo entirely (`external/whatsnow-toolkit/characters/olylo`).
      // The relative path from here is nine segments of `..` through two nested
      // checkouts, which is unreadable and silently wrong the moment either
      // package moves. One alias, defined once, is the whole fix.
      "@character": fileURLToPath(new URL("../../../../../../../../characters/olylo", import.meta.url)),
    },
  },
});
