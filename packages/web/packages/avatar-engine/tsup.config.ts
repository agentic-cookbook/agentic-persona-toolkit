import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/render/svg.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  clean: true,
  sourcemap: true,
});
