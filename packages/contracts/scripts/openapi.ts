import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderOpenAPIDocument } from "../src/openapi.js";

const outputPath = fileURLToPath(
  new URL("../../../apps/ios/Packages/RakazoAPI/Sources/RakazoAPI/openapi.json", import.meta.url),
);
const generated = renderOpenAPIDocument();

if (process.argv.includes("--check")) {
  let existing: string;
  try {
    existing = readFileSync(outputPath, "utf8");
  } catch {
    console.error("OpenAPI document is missing. Run pnpm contracts:generate.");
    process.exitCode = 1;
    process.exit();
  }
  if (existing !== generated) {
    console.error("OpenAPI document is stale. Run pnpm contracts:generate.");
    process.exitCode = 1;
  }
} else {
  writeFileSync(outputPath, generated);
}
