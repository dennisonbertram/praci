import { describe, expect, it, vi } from "vitest";
import { anyWordQuery, searchWithFallback } from "./data-room.js";

const thumbnailRepoState = vi.hoisted(() => ({
  claimed: [] as string[],
  claimError: null as Error | null,
  items: [] as { id: string }[],
  getItem: vi.fn(),
  restartItem: vi.fn(),
  deleteItem: vi.fn(async () => undefined),
  deleteOmiOutputs: vi.fn(async (): Promise<string[]> => []),
  release: vi.fn(async (_actor: unknown, id: string) => {
    thumbnailRepoState.claimed = thumbnailRepoState.claimed.filter((claimedId) => claimedId !== id);
  }),
}));
const loggerError = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/logging", () => ({ getLogger: () => ({ error: loggerError, warn: vi.fn() }) }));
vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  createDataRoomRepos: () => ({
    listItemsPage: async () => ({ items: thumbnailRepoState.items, nextCursor: null }),
    claimThumbnails: async () => {
      if (thumbnailRepoState.claimError) throw thumbnailRepoState.claimError;
      const claimed = [...thumbnailRepoState.claimed];
      thumbnailRepoState.claimed = [];
      return claimed;
    },
    releaseThumbnail: thumbnailRepoState.release,
    getItem: thumbnailRepoState.getItem,
    restartItem: thumbnailRepoState.restartItem,
    deleteItem: thumbnailRepoState.deleteItem,
  }),
  createDataRoomAutoSortRepos: () => ({}),
}));
vi.mock("@rakazo/adapters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/adapters")>()),
  deleteOmiRecordingOutputs: thumbnailRepoState.deleteOmiOutputs,
}));

import type { Actor } from "@rakazo/contracts";
import { createDataRoomService } from "./data-room.js";

const makeThumbnailItem = (id: string) =>
  ({
    id,
    name: "report.pdf",
    mimeType: "application/pdf",
    size: 1,
    sha256: "fake-sha",
    folderId: null,
    source: "upload",
    sourceUrl: null,
    status: "ready",
    error: null,
    notIndexed: false,
    docType: null,
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    thumbnailKey: null,
    previewText: null,
    storageKey: "fake/blob",
    thumbnailTriedAt: null,
  }) as never;

describe("thumbnail enqueue claims", () => {
  it("stops after the first enqueue failure and releases all remaining claims", async () => {
    const ids = ["thumbnail-1", "thumbnail-2", "thumbnail-3"];
    thumbnailRepoState.items = ids.map(makeThumbnailItem);
    thumbnailRepoState.claimed = ids;
    thumbnailRepoState.release.mockClear();
    const enqueue = vi.fn(async () => {
      throw new Error("queue unavailable");
    });
    const svc = createDataRoomService({
      prisma: {} as never,
      artifacts: {} as never,
      jobs: { enqueue } as never,
    });
    const actor = { userId: "thumbnail-user", spaceId: "thumbnail-space" } as Actor;
    const input = { limit: 20, sort: "newest" } as never;

    const result = await svc.items(actor, input);

    expect(result.items).toHaveLength(3);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(thumbnailRepoState.release.mock.calls).toEqual(ids.map((id) => [actor, id]));
  });

  it("does not repeat a successfully enqueued claim on the next read", async () => {
    const id = "thumbnail-success";
    thumbnailRepoState.items = [makeThumbnailItem(id)];
    thumbnailRepoState.claimed = [id];
    const enqueue = vi.fn(async () => undefined);
    const svc = createDataRoomService({
      prisma: {} as never,
      artifacts: {} as never,
      jobs: { enqueue } as never,
    });
    const actor = { userId: "thumbnail-user", spaceId: "thumbnail-space" } as Actor;
    const input = { limit: 20, sort: "newest" } as never;

    await svc.items(actor, input);
    await svc.items(actor, input);

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns the list and logs when releasing a failed claim rejects", async () => {
    const id = "thumbnail-release-failure";
    thumbnailRepoState.items = [makeThumbnailItem(id)];
    thumbnailRepoState.claimed = [id];
    thumbnailRepoState.release.mockRejectedValueOnce(new Error("release unavailable"));
    loggerError.mockClear();
    const enqueue = vi.fn(async () => {
      throw new Error("queue unavailable");
    });
    const svc = createDataRoomService({
      prisma: {} as never,
      artifacts: {} as never,
      jobs: { enqueue } as never,
    });
    const actor = { userId: "thumbnail-user", spaceId: "thumbnail-space" } as Actor;
    const input = { limit: 20, sort: "newest" } as never;

    await expect(svc.items(actor, input)).resolves.toMatchObject({ items: [{ id }] });
    expect(thumbnailRepoState.release).toHaveBeenCalledWith(actor, id);
    expect(loggerError).toHaveBeenCalledWith(
      "data room thumbnail claim release failed",
      expect.objectContaining({ message: "release unavailable" }),
    );
  });
});

it("returns the page and logs when claiming thumbnails fails", async () => {
  thumbnailRepoState.items = [makeThumbnailItem("claim-fail")];
  thumbnailRepoState.claimError = new Error("claim unavailable");
  loggerError.mockClear();
  const enqueue = vi.fn(async () => undefined);
  const svc = createDataRoomService({
    prisma: {} as never,
    artifacts: {} as never,
    jobs: { enqueue } as never,
  });
  try {
    await expect(
      svc.items({ userId: "u", spaceId: "s" } as Actor, { limit: 20, sort: "newest" } as never),
    ).resolves.toMatchObject({ items: [{ id: "claim-fail" }] });
  } finally {
    thumbnailRepoState.claimError = null;
  }
  expect(loggerError).toHaveBeenCalledWith(
    "data room thumbnail claim failed",
    expect.objectContaining({ message: "claim unavailable" }),
  );
  expect(enqueue).not.toHaveBeenCalled();
});

describe("deleteItem ordering", () => {
  const actor = { userId: "u", spaceId: "s" } as Actor;
  const make = (enqueue: ReturnType<typeof vi.fn>) =>
    createDataRoomService({
      prisma: {} as never,
      artifacts: {} as never,
      jobs: { enqueue } as never,
    });
  const reset = (source: string) => {
    thumbnailRepoState.getItem.mockReset();
    thumbnailRepoState.deleteItem.mockClear();
    thumbnailRepoState.deleteOmiOutputs.mockReset();
    thumbnailRepoState.deleteOmiOutputs.mockResolvedValue(["note-key"]);
    thumbnailRepoState.getItem.mockResolvedValue({
      storageKey: "own-key",
      thumbnailKey: "thumb-key",
      source,
    });
    loggerError.mockClear();
  };

  it("fails before deleting anything when the item's own blob job cannot be queued", async () => {
    reset("omi");
    const enqueue = vi.fn(async () => {
      throw new Error("queue down");
    });
    await expect(make(enqueue).deleteItem(actor, "i")).rejects.toBeDefined();
    expect(thumbnailRepoState.deleteOmiOutputs).not.toHaveBeenCalled();
    expect(thumbnailRepoState.deleteItem).not.toHaveBeenCalled();
  });

  it("still deletes the row when only a note blob job cannot be queued", async () => {
    reset("omi");
    const enqueue = vi.fn(async (job: unknown) => {
      if (JSON.stringify(job).includes("note-key")) throw new Error("queue down");
    });
    await expect(make(enqueue).deleteItem(actor, "i")).resolves.toEqual({ ok: true });
    expect(thumbnailRepoState.deleteItem).toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
  });
});

describe("retryItem", () => {
  it("returns the item and logs when the ingest job cannot be queued after the restart is saved", async () => {
    const actor = { userId: "u", spaceId: "s" } as Actor;
    const failed = { ...(makeThumbnailItem("i") as object), status: "failed" };
    thumbnailRepoState.getItem.mockReset();
    thumbnailRepoState.getItem.mockResolvedValue(failed);
    thumbnailRepoState.restartItem.mockReset();
    thumbnailRepoState.restartItem.mockResolvedValue(true);
    loggerError.mockClear();
    const enqueue = vi.fn(async () => {
      throw new Error("queue down");
    });
    const service = createDataRoomService({
      prisma: {} as never,
      artifacts: {} as never,
      jobs: { enqueue } as never,
    });
    await expect(service.retryItem(actor, "i")).resolves.toMatchObject({ id: "i" });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledWith("data room ingest enqueue failed", expect.any(Error));
  });
});

it("turns a question into any-word search terms, leaving a single word alone", () => {
  expect(anyWordQuery("when does our office lease end")).toBe(
    "when or does or our or office or lease or end",
  );
  expect(anyWordQuery("lease")).toBeNull();
  expect(anyWordQuery("  lease  ")).toBeNull();
});

it("does not broaden a query that already uses operators, so exclusions survive", () => {
  expect(anyWordQuery("lease -draft")).toBeNull();
  expect(anyWordQuery('"office lease" end')).toBeNull();
  expect(anyWordQuery("lease or end")).toBeNull();
});

it("keeps matching any word on every page of a broadened search", async () => {
  const pages: Record<string, { results: number[]; nextCursor: string | null }> = {
    "a or b|": { results: [1, 2], nextCursor: "c1" },
    "a or b|c1": { results: [3], nextCursor: null },
  };
  const searchPage = vi.fn(async (query: string, cursor: string | undefined) =>
    query === "a b" ? { results: [], nextCursor: null } : pages[`${query}|${cursor ?? ""}`]!,
  );
  const first = await searchWithFallback(searchPage, { query: "a b" });
  expect(first).toEqual({ results: [1, 2], nextCursor: "any:c1" });
  const second = await searchWithFallback(searchPage, { query: "a b", cursor: first.nextCursor! });
  expect(second).toEqual({ results: [3], nextCursor: null });
});
