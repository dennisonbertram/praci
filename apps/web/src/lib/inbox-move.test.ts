import { expect, it, vi } from "vitest";
import { moveInChunks } from "./inbox-move";

const ids = Array.from({ length: 120 }, (_, i) => `m${i}`);

it("calls in slices of 50, merges the results and collects each slice's batch id", async () => {
  const call = vi.fn(async ({ messageIds }: { op: string; messageIds: string[] }) => ({
    done: messageIds,
    failed: [],
    batchId: `batch-${messageIds[0]}`,
  }));
  const batchIds: string[] = [];

  const result = await moveInChunks("trash", ids, call as never, batchIds);

  expect(call.mock.calls.map(([input]) => input.messageIds.length)).toEqual([50, 50, 20]);
  expect(call.mock.calls.every(([input]) => input.op === "trash")).toBe(true);
  expect(result.done).toHaveLength(120);
  expect(batchIds).toEqual(["batch-m0", "batch-m50", "batch-m100"]);
});

it("keeps the batch ids of finished slices when a later slice throws", async () => {
  const call = vi
    .fn()
    .mockResolvedValueOnce({ done: ids.slice(0, 50), failed: [], batchId: "first" })
    .mockRejectedValueOnce(new Error("offline"));
  const batchIds: string[] = [];

  await expect(moveInChunks("spam", ids, call, batchIds)).rejects.toThrow("offline");

  expect(batchIds).toEqual(["first"]);
});
