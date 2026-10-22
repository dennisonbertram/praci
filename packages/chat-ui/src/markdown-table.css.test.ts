import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Layout is not computed in jsdom; the measured check is the NarrowPanelVendors story at 263 px.
const css = readFileSync(new URL("./markdown-table.css", import.meta.url), "utf8");
const narrow = css.slice(css.indexOf("@container (max-width: 24rem)"));

describe("docked panel table", () => {
  it("never breaks words mid-letter", () => {
    expect(narrow).not.toContain("overflow-wrap: anywhere");
  });
  it("gives text columns a readable minimum width", () => {
    expect(narrow).toMatch(/td:not\(\.rk-align-right\)[^{]*\{\s*min-width: 9ch !important/);
  });
});
