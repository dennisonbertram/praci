import type { CleanupSender, UnsubscribeOutput } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { type CleanupApi, runCleanup } from "./mail-cleanup-run.js";

const sender = (address: string, patch: Partial<CleanupSender> = {}): CleanupSender => ({
  connectionId: "c1",
  address,
  name: address,
  messageCount: 5,
  readCount: 0,
  lastReceivedAt: null,
  inboxThreads: 3,
  preselected: true,
  spamLike: false,
  unsubscribe: "link",
  skipInbox: false,
  unsubscribeStatus: null,
  ...patch,
});
const a = sender("a@example.test");
const b = sender("b@example.test");

const api = (patch: Partial<CleanupApi> = {}): CleanupApi => ({
  archive: vi.fn(async () => ({ batchId: "batch-1", done: 3, failed: 0, remaining: 0 })),
  unsubscribe: vi.fn(
    async (): Promise<UnsubscribeOutput> => ({ status: "done", method: "one_click" }),
  ),
  ...patch,
});

describe("runCleanup", () => {
  it("pages one sender's archive with the returned batch id until nothing remains", async () => {
    const pages = [
      { batchId: "batch-1", done: 50, failed: 0, remaining: 20 },
      { batchId: "batch-1", done: 20, failed: 0, remaining: 0 },
    ];
    const archive = vi.fn(async () => pages.shift() as never);

    const out = await runCleanup("archive", [a], api({ archive }));

    expect(archive).toHaveBeenNthCalledWith(1, {
      kind: "archive",
      connectionId: "c1",
      address: "a@example.test",
    });
    expect(archive).toHaveBeenNthCalledWith(2, {
      kind: "archive",
      connectionId: "c1",
      address: "a@example.test",
      batchId: "batch-1",
    });
    expect(out).toMatchObject({ batchIds: ["batch-1"], done: 70, failed: [] });
  });

  it("keeps no batch id for a sender whose archive changed nothing", async () => {
    const archive = vi.fn(async () => ({ batchId: "empty", done: 0, failed: 0, remaining: 0 }));
    const out = await runCleanup("skip_inbox", [a], api({ archive }));
    expect(out).toMatchObject({ batchIds: [], done: 0, failed: [] });
  });

  it("stops when a page changes nothing and reports the sender", async () => {
    const archive = vi.fn(async () => ({ batchId: "batch-1", done: 0, failed: 2, remaining: 2 }));

    const out = await runCleanup("archive", [a], api({ archive }));

    expect(archive).toHaveBeenCalledTimes(1);
    expect(out.failed).toEqual([{ sender: a, reason: "archive" }]);
  });

  it("unsubscribes first and archives only after a step that took effect", async () => {
    const archive = vi.fn(async () => ({ batchId: "b", done: 3, failed: 0, remaining: 0 }));
    const unsubscribe = vi
      .fn<CleanupApi["unsubscribe"]>()
      .mockResolvedValueOnce({ status: "done", method: "one_click" })
      .mockResolvedValueOnce({
        status: "opened",
        method: "link",
        openUrl: "https://lists.example.test/u",
      });

    const out = await runCleanup("unsubscribe", [a, b], api({ archive, unsubscribe }));

    expect(archive).toHaveBeenCalledTimes(2);
    expect(archive).toHaveBeenCalledWith({
      kind: "unsubscribe",
      connectionId: "c1",
      address: "a@example.test",
    });
    expect(out.openLinks).toEqual([{ sender: b, url: "https://lists.example.test/u" }]);
    expect(out.done).toBe(6);
  });

  it("does not archive after a failed or refused unsubscribe, and keeps the link of a failed one click", async () => {
    const archive = vi.fn();
    const unsubscribe = vi
      .fn<CleanupApi["unsubscribe"]>()
      .mockResolvedValueOnce({
        status: "failed",
        method: "one_click",
        openUrl: "https://lists.example.test/u",
      })
      .mockResolvedValueOnce({ status: "refused", method: null });

    const out = await runCleanup("unsubscribe", [a, b], api({ archive, unsubscribe }));

    expect(archive).not.toHaveBeenCalled();
    expect(out.failed).toEqual([
      { sender: a, reason: "unsubscribe", openUrl: "https://lists.example.test/u" },
      { sender: b, reason: "refused" },
    ]);
  });

  it("collects mailto senders for confirmation without archiving them, then sends once confirmed", async () => {
    const archive = vi.fn(async () => ({ batchId: "b", done: 3, failed: 0, remaining: 0 }));
    const unsubscribe = vi
      .fn<CleanupApi["unsubscribe"]>()
      .mockResolvedValueOnce({
        status: "needs_confirmation",
        method: "mailto",
        mailTo: "unsub@lists.example.test",
      })
      .mockResolvedValueOnce({ status: "sent", method: "mailto" });

    const first = await runCleanup("unsubscribe", [a], api({ archive, unsubscribe }));
    expect(first.confirm).toEqual([{ sender: a, mailTo: "unsub@lists.example.test" }]);
    expect(archive).not.toHaveBeenCalled();

    const second = await runCleanup("unsubscribe", [a], api({ archive, unsubscribe }), {
      confirmMailto: true,
    });
    expect(unsubscribe).toHaveBeenLastCalledWith({
      connectionId: "c1",
      address: "a@example.test",
      confirmMailto: true,
    });
    expect(second.done).toBe(3);
  });

  it("turns a thrown error into a failure for that sender and carries on", async () => {
    const archive = vi
      .fn<CleanupApi["archive"]>()
      .mockRejectedValueOnce(new Error("Gmail needs to be reconnected"))
      .mockResolvedValueOnce({ batchId: "b", done: 3, failed: 0, remaining: 0 });

    const out = await runCleanup("skip_inbox", [a, b], api({ archive }));

    expect(out.failed).toEqual([
      { sender: a, reason: "error", message: "Gmail needs to be reconnected" },
    ]);
    expect(out.done).toBe(3);
  });

  it("never loops forever on a sender that always reports more", async () => {
    const archive = vi.fn(async () => ({ batchId: "b", done: 1, failed: 0, remaining: 5 }));

    const out = await runCleanup("archive", [a], api({ archive }));

    expect(archive.mock.calls.length).toBeLessThanOrEqual(200);
    expect(out.failed[0]?.reason).toBe("archive");
  });
});
