/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("packaging", () => {
  it("declares no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies ?? {}).toEqual({});
  });

  it("imports nothing outside the package except test-only specifiers", () => {
    const files = import.meta.glob("../**/*.ts", { eager: true, query: "?raw", import: "default" });
    for (const [path, src] of Object.entries(files) as [string, string][]) {
      for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
        const spec = m[1]!;
        if (spec.startsWith(".")) continue;
        // `@character/*` is a Vitest-only alias (see `vitest.config.ts`) pointing at
        // olylo's config directory eight levels up. It is resolved by nothing but
        // Vitest, so it cannot appear in a published build — and the test above,
        // which asserts `dependencies` and `peerDependencies` are both empty, is
        // what actually enforces the zero-runtime-dependency constraint. This test
        // guards import *specifiers*, and the allow-list is already gated on
        // `.test.ts`, so widening it can never admit a runtime import.
        const allowed =
          path.endsWith(".test.ts") &&
          (spec.startsWith("node:") ||
            spec === "vitest" ||
            spec === "gsap" ||
            spec.startsWith("@character/"));
        expect(allowed, `${path} imports ${spec}`).toBe(true);
      }
    }
  });
});
