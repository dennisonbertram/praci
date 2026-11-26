import { describe, expect, it } from "vitest";
import { appContract } from "./rpc.js";

const updateDraftInput = appContract.skills.updateDraft["~orpc"].inputSchema as {
  safeParse(value: unknown): {
    success: boolean;
    error?: { issues: Array<{ message: string }> };
  };
};

const playbookWithStep = (step: string) => ({
  whenToUse: "",
  inputs: [],
  steps: [step],
  howToCheck: "",
  whatToReturn: "",
  approvalBoundaries: "",
  failureHandling: "",
});

describe("taught skill draft RPC input", () => {
  it("caps the serialized playbook size at 100000 characters", () => {
    const oversized = updateDraftInput.safeParse({
      skillId: "skill-1",
      playbook: playbookWithStep("x".repeat(100_001)),
    });
    expect(oversized.success).toBe(false);
    expect(oversized.error?.issues[0]?.message).toBe("Playbook must be at most 100000 characters.");

    const withinLimit = updateDraftInput.safeParse({
      skillId: "skill-1",
      playbook: playbookWithStep("x".repeat(99_000)),
    });
    expect(withinLimit.success).toBe(true);
  });
});
