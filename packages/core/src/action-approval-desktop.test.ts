import { describe, expect, it } from "vitest";
import {
  toolRequiresExplicitApproval,
  toolResultTaintsRun,
  toolRuleAllowsAllow,
} from "./action-approval.js";

describe("desktop app tools", () => {
  it("cannot be approved by a saved rule", () => {
    expect(toolRequiresExplicitApproval("desktop_app_act")).toBe(true);
    expect(toolRuleAllowsAllow("desktop_app_act")).toBe(false);
  });

  it("taints the run with their results", () => {
    for (const name of ["desktop_app_list", "desktop_app_snapshot", "desktop_app_act"]) {
      expect(toolResultTaintsRun(name)).toBe(true);
    }
  });
});
