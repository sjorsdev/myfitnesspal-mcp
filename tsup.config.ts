import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    shims: true,
  },
  {
    entry: { cli: "bin/cli.ts" },
    format: ["esm"],
    dts: false,
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
