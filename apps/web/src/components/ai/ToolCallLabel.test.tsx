import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
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

  it("replaces the phrase with the finished summary and lists the steps", () => {
    const out = html({
      name: "mail_search",
      summary: "Searched mail · 23 found",
      lines: [
        { text: 'Searching mail: from Kevin · "pick a time"' },
        { text: "Found 23 messages" },
      ],
    });
    expect(out).toContain(">Searched mail · 23 found<");
    expect(out).toContain('data-testid="tool-call-details"');
    expect(out).toContain("Found 23 messages");
  });

  it("keeps a failed step with its reason", () => {
    const out = html({
      name: "mail_search",
      state: "failed",
      lines: [{ text: "Could not finish this search: Gmail is limiting requests", failed: true }],
    });
    expect(out).toContain("text-destructive");
    expect(out).toContain("Gmail is limiting requests");
  });

  it("masks amounts in the summary and the steps while amounts are hidden", () => {
    setHideAmounts(true);
    try {
      const out = html({
        name: "mail_search",
        summary: "Searched mail · 1 found",
        lines: [{ text: 'Reading "Invoice for $12,400" from billing@example.test' }],
      });
      expect(out).not.toContain("12,400");
      expect(out).toContain("billing@example.test");
    } finally {
      setHideAmounts(false);
    }
  });
});
