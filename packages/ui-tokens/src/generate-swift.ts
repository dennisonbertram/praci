import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSwiftTokens } from "./swift-tokens.js";

function main(): void {
  const outputPath = fileURLToPath(
    new URL("../../../apps/ios/Packages/RakazoUI/Sources/RakazoUI/Tokens.swift", import.meta.url),
  );
  const rendered = renderSwiftTokens();

  if (process.argv.includes("--check")) {
    let existing: string;
    try {
      existing = readFileSync(outputPath, "utf8");
    } catch {
      console.error("Generated native tokens are missing. Run pnpm ios:tokens.");
      process.exitCode = 1;
      return;
    }
    if (existing !== rendered) {
      console.error("Native semantic colors are stale. Run pnpm ios:tokens.");
      process.exitCode = 1;
    }
    return;
  }

  writeFileSync(outputPath, rendered);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
