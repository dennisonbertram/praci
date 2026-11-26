import { APPROVAL_EXEMPT_TOOLS, BUILTIN_TOOL_RISK, toolRequiresApproval } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { agentConnectionTools, builtinAgentTools, gtmPostTool } from "./builtin-tools.js";

const builtins = [...builtinAgentTools, ...agentConnectionTools, gtmPostTool];

// Tools in no approval set are classified in BUILTIN_TOOL_RISK (packages/core/src/tool-risk.ts).
// Do not add a tool to neither: give it a profile or an approval class.
const unclassified = builtins
  .filter(
    (tool) =>
      !tool.readOnly &&
      !APPROVAL_EXEMPT_TOOLS.has(tool.name) &&
      !toolRequiresApproval(tool.name, false),
  )
  .map((tool) => tool.name);

describe("builtin tool approval classes", () => {
  it("gives every non-readOnly built-in a profile or an approval class", () => {
    expect(unclassified.filter((name) => !(name in BUILTIN_TOOL_RISK))).toEqual([]);
  });

  it("keeps the risk table free of removed, readOnly or approval-gated tools", () => {
    const names = new Map(builtins.map((tool) => [tool.name, tool]));
    expect(
      Object.keys(BUILTIN_TOOL_RISK).filter((name) => {
        const tool = names.get(name);
        return (
          !tool ||
          tool.readOnly ||
          APPROVAL_EXEMPT_TOOLS.has(name) ||
          toolRequiresApproval(name, false)
        );
      }),
    ).toEqual([]);
  });

  it("profiles reads as reads and never gives a write a read profile", () => {
    const reads = Object.entries(BUILTIN_TOOL_RISK)
      .filter(([, risk]) => risk.effect === "read")
      .map(([name]) => name)
      .sort();
    expect(reads).toEqual([
      "company_context_lookup",
      "list_secrets",
      "recall_memory",
      "scratchpad_list",
      "skill_read",
    ]);
  });

  it("marks nothing in the table as moving money", () => {
    expect(Object.values(BUILTIN_TOOL_RISK).filter((risk) => risk.money)).toEqual([]);
  });
});
