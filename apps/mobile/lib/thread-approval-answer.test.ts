import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/thread.tsx", import.meta.url), "utf8");
const answerHandler = source.slice(
  source.indexOf("const answerMessage = useCallback("),
  source.indexOf(
    "const openBot = useCallback(",
    source.indexOf("const answerMessage = useCallback("),
  ),
);

describe("mobile approval answer recovery", () => {
  it("refreshes the thread when an answer request fails", () => {
    expect(answerHandler).toMatch(/catch\s*\([^)]*\)[\s\S]*?refresh\(\)/);
  });
});
