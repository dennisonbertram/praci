import { describe, expect, it } from "vitest";
import { previewFromBlocks } from "./thread-listing.js";

describe("previewFromBlocks", () => {
  it("shows a Data room file by its name, without the raw id line", () => {
    const line = "Data room item itm_9: Sample agreement.pdf";
    expect(previewFromBlocks([{ kind: "text", text: `Summarise this\n\n${line}` }])).toBe(
      "Summarise this",
    );
    expect(previewFromBlocks([{ kind: "text", text: line }])).toBe("Sample agreement.pdf");
  });

  it("preserves literal URL paths in autolinks", () => {
    expect(previewFromBlocks([{ kind: "text", text: "Open <https://example.test/_draft_>" }])).toBe(
      "Open https://example.test/_draft_",
    );
  });
  it("preserves filenames while removing surrounding Markdown", () => {
    expect(previewFromBlocks([{ kind: "text", text: "Saved **monthly_sales_report.csv**" }])).toBe(
      "Saved monthly_sales_report.csv",
    );
  });
  it("returns the first text block with Markdown stripped", () => {
    expect(
      previewFromBlocks([
        { kind: "steps", steps: [{ label: "Read file", count: 1 }] },
        { kind: "text", text: "Created **Projects-CoS** as a **Project**" },
      ]),
    ).toBe("Created Projects-CoS as a Project");
  });

  it("leaves a Markdown table out of the preview", () => {
    const table =
      "| Vendor | Amount |\n| --- | ---: |\n| Northstar Paper Co. | $420 |\n| Juniper | $1,250 |";
    expect(previewFromBlocks([{ kind: "text", text: table }])).toBe("Table, 2 rows");
    expect(previewFromBlocks([{ kind: "text", text: `Here are the vendors:\n\n${table}` }])).toBe(
      "Here are the vendors:",
    );
  });

  it("reads one phrase for the latest call when a turn ended in tool calls only", () => {
    expect(
      previewFromBlocks([
        { kind: "steps", steps: [{ label: "Get banking transactions", count: 1 }] },
      ]),
    ).toBe("Checked banking transactions");
  });

  it("counts several tool calls instead of listing them", () => {
    expect(
      previewFromBlocks([
        {
          kind: "steps",
          steps: [
            { label: "Get active integration", count: 1 },
            { label: "Get banking transactions", count: 1 },
          ],
        },
      ]),
    ).toBe("Used 2 tools");
  });

  it("prefers the reply over the tool calls that came before it", () => {
    expect(
      previewFromBlocks([
        { kind: "steps", steps: [{ label: "Get banking transactions", count: 1 }] },
        { kind: "text", text: "You spent less than last month." },
      ]),
    ).toBe("You spent less than last month.");
  });

  it("ignores live tool activity and lists of tool ids", () => {
    expect(
      previewFromBlocks([
        { kind: "progress", text: "Using brex: get_banking_transactions", activity: true },
        { kind: "steps", steps: [{ label: "Get banking transactions", count: 1 }] },
      ]),
    ).toBe("Checked banking transactions");
    expect(
      previewFromBlocks([{ kind: "text", text: "get_active_integration get_banking_tr…" }]),
    ).toBe("");
  });

  it("reads a leading run of tool ids as words", () => {
    expect(
      previewFromBlocks([
        {
          kind: "text",
          text: "get_active_integration get_banking_transactions list_cards and more",
        },
      ]),
    ).toBe("Get active integration, Get banking transactions, List cards, and more");
  });

  it("returns empty when there is no text block", () => {
    expect(previewFromBlocks([{ kind: "steps", steps: [] }])).toBe("");
    expect(previewFromBlocks(undefined)).toBe("");
  });
});
