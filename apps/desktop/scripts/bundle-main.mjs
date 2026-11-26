import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Workspace contracts export source; Electron needs JavaScript without a TypeScript loader.
export function bundleMain(outfile) {
  return build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    entryPoints: ["src/main.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    external: ["electron", "electron-updater", "@kitlangton/hex"],
    metafile: true,
    sourcemap: true,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await bundleMain("dist/main.js");
}
