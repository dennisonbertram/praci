import { unattendedTriggerToolRequiresApproval } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { selectBuiltinToolsForRun } from "./executor.js";
import { uiArtifactFileName } from "./ui-artifact-tool.js";

describe("create_ui_artifact", () => {
  const base = {
    graphicalToolsAllowed: false,
    groupId: null,
    trigger: "user",
    semanticMemoryEnabled: false,
    messagingChannelRun: false,
  };
  const tool = (over: object = {}) =>
    selectBuiltinToolsForRun({ ...base, ...over }).find((t) => t.name === "create_ui_artifact");

  it("is offered with a block schema, and can be turned off", () => {
    const offered = tool();
    expect(offered).toBeDefined();
    expect(JSON.stringify(offered?.inputSchema)).toContain('"metric"');
    expect(tool({ disabledBuiltinTools: ["create_ui_artifact"] })).toBeUndefined();
  });

  it("is approved like the other tools that create a file", () => {
    expect(unattendedTriggerToolRequiresApproval("webhook", "create_ui_artifact", false)).toBe(
      unattendedTriggerToolRequiresApproval("webhook", "create_spreadsheet", false),
    );
  });

  it("names the file after the title without path characters", () => {
    expect(uiArtifactFileName("Q3 / Sales: ../etc")).toBe("Q3-Sales-etc.rkui");
    expect(uiArtifactFileName("???")).toBe("artifact.rkui");
  });
});
