import { describe, expect, it, vi } from "vitest";
import { discardAnsweredSteering } from "./events.js";

describe("discardAnsweredSteering", () => {
  function client(reply: { seq: number } | null, payloads: unknown[] = []) {
    return {
      message: { findFirst: vi.fn().mockResolvedValue(reply) },
      event: { findMany: vi.fn().mockResolvedValue(payloads.map((payload) => ({ payload }))) },
      steeringMessage: { deleteMany: vi.fn() },
    };
  }

  it("requires a text reply and a durable claim watermark", async () => {
    const tx = client(null);
    await discardAnsweredSteering(tx as never, { threadId: "thread-1", runId: "run-1" });
    expect(tx.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: expect.arrayContaining([
            { blocks: { array_contains: [{ kind: "ask" }] } },
            { blocks: { array_contains: [{ kind: "steps" }] } },
          ]),
        }),
      }),
    );
    expect(tx.event.findMany).not.toHaveBeenCalled();
    expect(tx.steeringMessage.deleteMany).not.toHaveBeenCalled();
    tx.message.findFirst.mockResolvedValue({ seq: 8 });
    await discardAnsweredSteering(tx as never, { threadId: "thread-1", runId: "run-1" });
    expect(tx.steeringMessage.deleteMany).not.toHaveBeenCalled();
  });

  it("only discards claims ordered before a reply, including the next sequence", async () => {
    const tx = client({ seq: 8 }, [
      { steeringIds: ["answered"], nextMessageSeq: 8 },
      { steeringIds: ["later"], nextMessageSeq: 9 },
      { steeringIds: ["legacy"] },
      null,
    ]);
    await discardAnsweredSteering(tx as never, { threadId: "thread-1", runId: "run-1" });
    expect(tx.steeringMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        runId: "run-1",
        claimedAt: { not: null },
        id: { in: ["answered"] },
      },
    });
  });
});
