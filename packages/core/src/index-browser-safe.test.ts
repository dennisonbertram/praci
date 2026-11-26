import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The web app imports "@rakazo/core"; a node: import anywhere it reaches breaks the browser bundle
// (a blank page). Node-only modules are published under "@rakazo/core/node/...".
const here = dirname(fileURLToPath(import.meta.url));

function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const source = readFileSync(entry, "utf8");
  for (const match of source.matchAll(/(?:import|export)[^"']*?from\s+["'](\.[^"']+)["']/g)) {
    if (/^\s*(import|export)\s+type\b/.test(match[0])) continue;
    const relativePath = match[1];
    if (!relativePath) continue;
    reachable(resolve(dirname(entry), relativePath.replace(/\.js$/, ".ts")), seen);
  }
  return seen;
}

describe("@rakazo/core index", () => {
  it("reaches no node: module, so the web bundle loads", () => {
    const offenders = [...reachable(resolve(here, "index.ts"))].filter((file) =>
      /from\s+["']node:/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => file.slice(here.length + 1))).toEqual([]);
  });
});
