import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bundleMain } from "../scripts/bundle-main.mjs";

describe("desktop build", () => {
  it("bundles shared source contracts instead of requiring a runtime TypeScript loader", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "rakazo-desktop-build-"));
    try {
      const outfile = path.join(directory, "main.mjs");
      const { metafile } = await bundleMain(outfile);
      expect(Object.keys(metafile.inputs)).toContain("../../packages/contracts/src/scanner.ts");
      const imports = Object.values(metafile.outputs).flatMap((output) => output.imports);
      expect(imports.some((entry) => entry.path === "electron")).toBe(true);
      for (const entry of imports) {
        expect(
          entry.path.startsWith("node:") ||
            ["electron", "electron-updater", "@kitlangton/hex"].includes(entry.path),
          entry.path,
        ).toBe(true);
      }
      execFileSync(process.execPath, ["--check", outfile], {
        env: { ...process.env, NODE_OPTIONS: "" },
        stdio: "pipe",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
