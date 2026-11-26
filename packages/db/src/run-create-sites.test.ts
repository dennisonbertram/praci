import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every place that creates a Run must decide its mode (`unattended`, see newRunUnattended in
 * @rakazo/core). The column defaults to true so a forgotten site fails closed, but a forgotten
 * owner-live site would silently turn into an unattended run; this test makes the omission loud.
 * It scans the source text of apps/ and packages/ for `run.create(` calls (tests, generated code,
 * the testkit and node_modules excluded) and checks that each call's argument mentions `unattended`.
 */
const root = fileURLToPath(new URL("../../..", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", "testkit", ".next", "build"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(path);
    return /\.ts$/.test(entry.name) && !/\.(test|d)\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** The text of a call's argument list, from the opening parenthesis to its match. */
function callBody(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "(") depth++;
    if (source[i] === ")" && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

describe("run creation sites", () => {
  it("set the run mode at every run.create call", () => {
    const missing: string[] = [];
    let sites = 0;
    for (const file of [
      ...sourceFiles(join(root, "apps")),
      ...sourceFiles(join(root, "packages")),
    ]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\brun\.create\(/g)) {
        sites++;
        if (!/\bunattended\b/.test(callBody(source, match.index + match[0].length - 1))) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${file.slice(root.length)}:${line}`);
        }
      }
    }
    expect(sites).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });
});
