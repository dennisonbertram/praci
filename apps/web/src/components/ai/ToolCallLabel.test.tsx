import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolCallLabel } from "./ToolCallLabel";

const html = (props: Parameters<typeof ToolCallLabel>[0]) =>
  renderToStaticMarkup(<ToolCallLabel {...props} />);

describe("ToolCallLabel", () => {
  const id = "mcp__finance-brex__get_banking_transactions";

  it("shows a past-tense phrase when done, with the raw id only as the tooltip", () => {
    const out = html({ name: id });
    expect(out).toContain(">Checked banking transactions<");
    expect(out).toContain(`title="${id}"`);
    expect(out).not.toMatch(/>[^<]*(mcp__|_)[^<]*</);
  });

  it("shows an activity phrase while running or waiting for approval", () => {
    expect(html({ name: id, state: "running" })).toContain("Checking banking transactions");
    expect(html({ name: id, state: "waiting" })).toContain(">Checking banking transactions<");
  });

  it("marks each state and shows a count above one", () => {
    expect(html({ name: id, state: "failed" })).toContain('data-state="failed"');
    expect(html({ name: id, count: 3 })).toContain("×3");
    expect(html({ name: id })).not.toContain("×");
  });

  it("falls back to the given name when it has no words", () => {
    expect(html({ name: "__" })).toContain(">__<");
  });
});
