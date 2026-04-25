import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["cli/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
  dts: false,
  minify: false,
  splitting: false,
  sourcemap: false,
});
