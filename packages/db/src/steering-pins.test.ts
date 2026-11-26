import { describe, expect, it, vi } from "vitest";
import { createPendingSteeringRun } from "./steering.js";

function row(id: string, seq: number, modelCredentialId: string | null) {
  return {
    id,
    userId: "user-1",
    originTrigger: null,
    modelProvider: "openai-compatible",
    modelId: "m",
    modelCredentialId,
    thinkingLevel: null,
    message: { id: `message-${id}`, blocks: [], seq },
  };
}

describe("createPendingSteeringRun with connection pins", () => {
  it("claims only the rows on the first row's connection and leaves the rest pending", async () => {
    const tx = {
      run: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "run-new" }),
      },
      steeringMessage: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            row("s1", 1, "cred-a"),
            row("s2", 2, "cred-b"),
            row("s3", 3, "cred-a"),
          ]),
        updateMany: vi.fn(),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    await createPendingSteeringRun(tx as never, {
      spaceId: "space-1",
      threadId: "thread-1",
      botId: "bot-1",
    });

    expect(tx.run.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ modelCredentialId: "cred-a", modelPinned: true }),
    });
    expect(tx.steeringMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["s1", "s3"] }, runId: null } }),
    );
  });
});
