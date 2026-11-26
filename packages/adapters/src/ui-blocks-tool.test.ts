import { unattendedTriggerToolRequiresApproval } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { selectBuiltinToolsForRun } from "./executor.js";
import { parseUiBlocks } from "./ui-blocks-tool.js";

const base = {
  graphicalToolsAllowed: false,
  groupId: null,
  trigger: "user",
  semanticMemoryEnabled: false,
  messagingChannelRun: false,
};
const offered = (over: object = {}) =>
  selectBuiltinToolsForRun({ ...base, ...over }).some((t) => t.name === "render_ui");

describe("render_ui", () => {
  it("is offered, can be turned off, and is not offered to voice or external bots", () => {
    expect(offered()).toBe(true);
    expect(offered({ disabledBuiltinTools: ["render_ui"] })).toBe(false);
    expect(offered({ voiceAgent: true })).toBe(false);
    expect(offered({ audience: "external" })).toBe(false);
  });

  it("needs no approval in a background run", () => {
    expect(unattendedTriggerToolRequiresApproval("webhook", "render_ui", false)).toBe(false);
  });

  it("returns the blocks, or problems the model can fix", () => {
    const ok = parseUiBlocks({ blocks: [{ type: "callout", tone: "info", body: "x" }] });
    expect(ok).toEqual({ ok: true, blocks: [{ type: "callout", tone: "info", body: "x" }] });
    const bad = parseUiBlocks({
      blocks: [{ type: "table", columns: [{ label: "A" }], rows: [["1", "2"]] }],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems.join(" ")).toContain("1 columns");
    expect(parseUiBlocks({}).ok).toBe(false);
  });
});
