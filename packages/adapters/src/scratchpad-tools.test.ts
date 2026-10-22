import { describe, expect, it, vi } from "vitest";
import { builtinAgentTools } from "./builtin-tools.js";
import {
  addScratchpadItemFromTool,
  clearPostStamp,
  completeScratchpadItemFromTool,
  consumeApprovedPost,
  findWorkableOpenItem,
  hasApprovedOpenPost,
  hasApprovedOpenSignup,
  listScratchpadItems,
  listScratchpadItemsFromTool,
  mapScratchpadItem,
  removeScratchpadItemFromTool,
  removeScratchpadItemFromUser,
  updateScratchpadItemFromTool,
  updateScratchpadItemFromUser,
} from "./scratchpad-tools.js";

const now = new Date("2026-08-25T12:00:00.000Z");
const scope = { spaceId: "ws", userId: "user", botId: "bot" };
const effectKey = `run-1:posts_create:${"a".repeat(64)}`;

function row(partial: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    ...scope,
    title: "Post",
    status: "parked",
    notes: "Exact post",
    category: "public_post",
    channel: "x",
    target: "account-1",
    scheduledFor: new Date("2026-08-25T13:00:00.000Z"),
    proof: null,
    approvedAt: null,
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function prismaWith(overrides: Record<string, unknown> = {}) {
  const executeRaw = vi.fn(async (_query: TemplateStringsArray, _lockKey: string) => 1);
  const queryRaw = vi.fn(async (_query: TemplateStringsArray) => [{ now }]);
  const scratchpadItem = {
    findFirst: vi.fn(async () => row()),
    findMany: vi.fn(async () => []),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
      row({
        ...data,
        category: data.category ?? null,
        channel: data.channel ?? null,
        target: data.target ?? null,
        scheduledFor: data.scheduledFor ?? null,
        proof: null,
        approvedAt: null,
        approvedBy: null,
      }),
    ),
    updateMany: vi.fn(async () => ({ count: 1 })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => row(data)),
    deleteMany: vi.fn(async () => ({ count: 1 })),
    ...overrides,
  };
  const scratchpadApproval = {
    findMany: vi.fn(async () => [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }]),
    count: vi.fn(async () => 0),
    create: vi.fn(async () => ({})),
  };
  const tx = { scratchpadItem, scratchpadApproval, $executeRaw: executeRaw, $queryRaw: queryRaw };
  return {
    scratchpadItem,
    scratchpadApproval,
    executeRaw,
    queryRaw,
    $transaction: vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx)),
  };
}

describe("scratchpad tools store", () => {
  it("uses the Postgres clock after locking and reloading for the production approval window and grant", async () => {
    const prisma = prismaWith({
      findFirst: vi.fn(async () => row({ category: "create_account", channel: "directory" })),
    });
    const databaseNow = new Date("2000-01-02T03:04:05.000Z");
    prisma.queryRaw.mockResolvedValue([{ now: databaseNow }]);
    const result = await updateScratchpadItemFromTool(
      { prisma: prisma as never },
      { ...scope, itemId: "item-1", status: "open" },
    );
    expect(result).toMatchObject({ item: { approvedAt: databaseNow.toISOString() } });
    expect(prisma.queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.queryRaw.mock.calls[0]?.[0].join("")).toBe("SELECT clock_timestamp() AS now");
    const clockCall = prisma.queryRaw.mock.invocationCallOrder[0]!;
    expect(prisma.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(clockCall);
    expect(prisma.scratchpadItem.findFirst.mock.invocationCallOrder[1]).toBeLessThan(clockCall);
    expect(prisma.scratchpadApproval.findMany.mock.invocationCallOrder[0]).toBeGreaterThan(
      clockCall,
    );
    expect(prisma.scratchpadApproval.count).toHaveBeenCalledWith({
      where: {
        ...scope,
        category: "create_account",
        channel: "directory",
        approvedBy: "policy",
        approvedAt: { gt: new Date(databaseNow.getTime() - 86_400_000), lte: databaseNow },
      },
    });
    expect(prisma.scratchpadItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvedAt: databaseNow }),
      }),
    );
    expect(prisma.scratchpadApproval.create).toHaveBeenCalledWith({
      data: {
        ...scope,
        itemId: "item-1",
        category: "create_account",
        channel: "directory",
        approvedBy: "policy",
        approvedAt: databaseNow,
      },
    });
  });

  it.each([
    [2, 0, false],
    [3, 4, true],
    [4, 5, false],
    [4, 6, false],
  ])(
    "directory policy with %i founder items and %i grants opens: %s",
    async (founders, grants, opens) => {
      const prisma = prismaWith({
        findFirst: vi.fn(async () => row({ category: "create_account", channel: "directory" })),
      });
      prisma.scratchpadApproval.findMany.mockResolvedValue(
        Array.from({ length: founders }, (_, i) => ({ itemId: `founder-${i}` })),
      );
      prisma.scratchpadApproval.count.mockResolvedValue(grants);
      const result = await updateScratchpadItemFromTool(
        { prisma: prisma as never, now: () => now },
        { ...scope, itemId: "item-1", status: "open" },
      );
      expect("item" in result).toBe(opens);
      expect(prisma.queryRaw).not.toHaveBeenCalled();
      expect(prisma.scratchpadApproval.create).toHaveBeenCalledTimes(opens ? 1 : 0);
      if (opens) {
        expect(result).toMatchObject({ item: { status: "open", approvedBy: "policy" } });
        expect(prisma.executeRaw.mock.calls[0]?.[1]).toBe("gtm-channel:ws:user:bot:directory");
        expect(prisma.scratchpadApproval.findMany).toHaveBeenCalledWith({
          where: {
            ...scope,
            category: "create_account",
            channel: "directory",
            approvedBy: "user",
            approvedAt: { gt: new Date(now.getTime() - 86_400_000), lte: now },
          },
          distinct: ["itemId"],
          select: { itemId: true },
        });
      }
    },
  );

  it("records directory founder approval atomically and records nothing on a lost update", async () => {
    const prisma = prismaWith({
      findFirst: vi.fn(async () => row({ category: "create_account", channel: "directory" })),
    });
    const input = { ...scope, itemId: "item-1", status: "open", updatedAt: now.toISOString() };
    expect(
      await updateScratchpadItemFromUser({ prisma: prisma as never, now: () => now }, input),
    ).toMatchObject({ item: { approvedBy: "user" } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.scratchpadApproval.create).toHaveBeenCalledWith({
      data: {
        ...scope,
        itemId: "item-1",
        category: "create_account",
        channel: "directory",
        approvedBy: "user",
        approvedAt: now,
      },
    });
    prisma.scratchpadApproval.create.mockClear();
    prisma.scratchpadItem.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateScratchpadItemFromUser({ prisma: prisma as never }, input)).toEqual({
      conflict: true,
    });
    expect(prisma.scratchpadApproval.create).not.toHaveBeenCalled();
  });

  it("does not approve directory content changed while waiting for the lock", async () => {
    const initial = row({ category: "create_account", channel: "directory" });
    const prisma = prismaWith({
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValue({
          ...initial,
          notes: "Changed",
          updatedAt: new Date(now.getTime() + 1),
        }),
    });
    expect(
      await updateScratchpadItemFromUser(
        { prisma: prisma as never },
        { ...scope, itemId: "item-1", status: "open", updatedAt: now.toISOString() },
      ),
    ).toEqual({ conflict: true });
    expect(prisma.scratchpadItem.updateMany).not.toHaveBeenCalled();
    expect(prisma.scratchpadApproval.create).not.toHaveBeenCalled();
  });

  it("maps new nullable fields and tolerates old rows", () => {
    const mapped = mapScratchpadItem(row());
    expect(mapped).toMatchObject({
      category: "public_post",
      channel: "x",
      target: "account-1",
      scheduledFor: "2026-08-25T13:00:00.000Z",
      proof: null,
      approvedAt: null,
      approvedBy: null,
    });
    expect(
      mapScratchpadItem(
        row({
          category: undefined,
          channel: undefined,
          target: undefined,
          scheduledFor: undefined,
          proof: undefined,
          approvedAt: undefined,
          approvedBy: undefined,
        }),
      ),
    ).toMatchObject({
      category: null,
      channel: null,
      target: null,
      scheduledFor: null,
      proof: null,
      approvedAt: null,
      approvedBy: null,
    });
  });

  it("lists items scoped to space, user, and bot", async () => {
    const prisma = prismaWith({ findMany: vi.fn(async () => [row()]) });
    await listScratchpadItems({ prisma: prisma as never }, { ...scope });
    expect(prisma.scratchpadItem.findMany).toHaveBeenCalledWith({
      where: {
        ...scope,
        status: { in: ["open", "parked"] },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });

  it("keeps plain-item defaults and semantics", async () => {
    const prisma = prismaWith();
    const result = await addScratchpadItemFromTool(
      { prisma: prisma as never },
      { ...scope, title: "  Ship PR  ", notes: " after review " },
    );
    expect(prisma.scratchpadItem.create).toHaveBeenCalledWith({
      data: { ...scope, title: "Ship PR", status: "open", notes: "after review" },
    });
    expect(result).toMatchObject({ item: { status: "open", category: null } });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: prisma as never },
        { ...scope, itemId: "item-1", title: "Draft v2", status: "parked" },
      ),
    ).resolves.toMatchObject({ item: { title: "Draft v2", status: "parked" } });
  });

  it("creates gated work parked by default and rejects explicit open or done", async () => {
    const prisma = prismaWith();
    const create = (status?: string) =>
      addScratchpadItemFromTool(
        { prisma: prisma as never },
        { ...scope, title: "Post", category: "public_post", ...(status ? { status } : {}) },
      );
    await expect(create()).resolves.toMatchObject({ item: { status: "parked" } });
    await expect(create("open")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(create("done")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(
      addScratchpadItemFromTool({ prisma: prisma as never }, {
        ...scope,
        title: "Post",
        category: "public_post",
        proof: "https://social.example/post/1",
      } as never),
    ).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("validates category, channel, target/proof lengths, absolute dates, and draft-only channels", async () => {
    const prisma = prismaWith();
    const add = (input: Record<string, unknown>) =>
      addScratchpadItemFromTool({ prisma: prisma as never }, {
        ...scope,
        title: "Plan",
        ...input,
      } as never);
    await expect(add({ category: "unrecognized" })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(add({ channel: "mastodon" })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(add({ target: "x".repeat(201) })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(
      updateScratchpadItemFromTool({ prisma: prisma as never }, {
        ...scope,
        itemId: "item-1",
        proof: "x".repeat(2_001),
      } as never),
    ).resolves.toMatchObject({ error: expect.any(String) });
    await expect(add({ scheduledFor: "tomorrow" })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(add({ category: "public_post", channel: "reddit" })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(add({ category: "public_post", channel: "hn" })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(add({ category: "public_post", channel: "producthunt" })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(add({ category: "create_account", channel: "reddit" })).resolves.toMatchObject({
      error: expect.any(String),
    });
  });

  it("rejects category or channel on updates even when raw arguments bypass schemas", async () => {
    const prisma = prismaWith();
    await expect(
      updateScratchpadItemFromTool({ prisma: prisma as never }, {
        ...scope,
        itemId: "item-1",
        title: "change",
        category: "draft",
      } as never),
    ).resolves.toMatchObject({ error: expect.any(String) });
    await expect(
      updateScratchpadItemFromTool({ prisma: prisma as never }, {
        ...scope,
        itemId: "item-1",
        channel: "linkedin",
      } as never),
    ).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("allows agent edits before approval and freezes title, notes, target, and schedule after approval", async () => {
    const before = row({ status: "parked" });
    const prisma = prismaWith({
      findFirst: vi.fn(async () => before),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: prisma as never },
        {
          ...scope,
          itemId: before.id,
          title: "New draft",
          notes: "Edited copy",
          target: "account-2",
          scheduledFor: "2026-08-25T14:00:00+01:00",
        },
      ),
    ).resolves.toMatchObject({ item: expect.any(Object) });
    expect(prisma.scratchpadItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(scope),
        data: expect.objectContaining({
          title: "New draft",
          notes: "Edited copy",
          target: "account-2",
          scheduledFor: new Date("2026-08-25T13:00:00.000Z"),
        }),
      }),
    );

    const approved = row({ status: "open", approvedAt: now, approvedBy: "user" });
    const frozen = prismaWith({ findFirst: vi.fn(async () => approved) });
    for (const edit of [
      { title: "x" },
      { notes: "x" },
      { target: "x" },
      { scheduledFor: "2026-08-25T15:00:00Z" },
    ]) {
      await expect(
        updateScratchpadItemFromTool({ prisma: frozen as never }, {
          ...scope,
          itemId: approved.id,
          ...edit,
        } as never),
      ).resolves.toMatchObject({ error: expect.any(String) });
    }
  });

  it("does not let an agent open gated categories or reopen completed gated work", async () => {
    for (const category of ["public_post", "create_account", "outbound_email"]) {
      const prisma = prismaWith({
        findFirst: vi.fn(async () => row({ category, status: "parked" })),
      });
      await expect(
        updateScratchpadItemFromTool(
          { prisma: prisma as never },
          {
            ...scope,
            itemId: "item-1",
            status: "open",
          },
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
      const done = prismaWith({ findFirst: vi.fn(async () => row({ category, status: "done" })) });
      await expect(
        updateScratchpadItemFromTool(
          { prisma: done as never },
          {
            ...scope,
            itemId: "item-1",
            status: "open",
          },
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
      await expect(
        updateScratchpadItemFromTool(
          { prisma: done as never },
          {
            ...scope,
            itemId: "item-1",
            status: "parked",
          },
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
    }
  });

  it("re-parks without clearing proof, while clearing approval fields", async () => {
    const approved = row({ status: "open", proof: effectKey, approvedAt: now, approvedBy: "user" });
    const updateMany = vi.fn(async (_args: unknown) => ({ count: 1 }));
    const prisma = prismaWith({
      findFirst: vi.fn(async () => approved),
      updateMany,
    });
    await updateScratchpadItemFromTool(
      { prisma: prisma as never },
      {
        ...scope,
        itemId: approved.id,
        status: "parked",
        proof: effectKey,
        notes: "Check the queue",
      },
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "parked",
          notes: "Check the queue",
          approvedAt: null,
          approvedBy: null,
        }),
      }),
    );
    expect(updateMany.mock.calls[0]?.[0]).not.toMatchObject({
      data: expect.objectContaining({ proof: null }),
    });
  });

  it("requires valid forward-only proof to complete gated items", async () => {
    const gated = row({ status: "open", approvedAt: now, approvedBy: "user" });
    const prisma = prismaWith({ findFirst: vi.fn(async () => gated) });
    await expect(
      completeScratchpadItemFromTool({ prisma: prisma as never }, { ...scope, itemId: gated.id }),
    ).resolves.toMatchObject({ error: expect.any(String) });
    const postWithUrl = prismaWith({
      findFirst: vi.fn(async () => gated),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: postWithUrl as never },
        {
          ...scope,
          itemId: gated.id,
          proof: "https://social.example/post/123",
          status: "done",
        },
      ),
    ).resolves.toMatchObject({ item: expect.any(Object) });
    const invalid = ["javascript:alert(1)", "not-a-url", "zernio:"];
    for (const proof of invalid) {
      await expect(
        updateScratchpadItemFromTool(
          { prisma: prisma as never },
          { ...scope, itemId: gated.id, proof },
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
    }
    const stamped = prismaWith({
      findFirst: vi.fn(async () =>
        row({ proof: "zernio:post-1", status: "open", approvedAt: now }),
      ),
    });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: stamped as never },
        {
          ...scope,
          itemId: "item-1",
          proof: "zernio:post-2",
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
    const email = prismaWith({
      findFirst: vi.fn(async () =>
        row({ category: "outbound_email", channel: "email", status: "open", approvedAt: now }),
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: email as never },
        {
          ...scope,
          itemId: "item-1",
          proof: "gmail:item-1",
          status: "done",
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
    const signup = prismaWith({
      findFirst: vi.fn(async () =>
        row({ category: "create_account", channel: "directory", status: "open", approvedAt: now }),
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: signup as never },
        {
          ...scope,
          itemId: "item-1",
          proof: "http://directory.example/profile/1",
          status: "done",
        },
      ),
    ).resolves.toMatchObject({ item: expect.any(Object) });
    const immutableUrl = prismaWith({
      findFirst: vi.fn(async () =>
        row({
          category: "create_account",
          channel: "directory",
          status: "done",
          approvedAt: now,
          proof: "https://directory.example/profile/1",
        }),
      ),
    });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: immutableUrl as never },
        {
          ...scope,
          itemId: "item-1",
          proof: "https://directory.example/profile/2",
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("allows public-post proof to progress from null or effect stamp through Zernio to URL", async () => {
    for (const [oldProof, proof] of [
      [undefined, "zernio:post-1"],
      [null, "https://social.example/post/1"],
      [effectKey, "zernio:post-1"],
      [effectKey, "https://social.example/post/1"],
      ["zernio:post-1", "https://social.example/post/1"],
    ] as const) {
      const existing = row({ proof: oldProof, status: "open", approvedAt: now });
      const prisma = prismaWith({
        findFirst: vi.fn(async () => existing),
        updateMany: vi.fn(async () => ({ count: 1 })),
      });
      await expect(
        updateScratchpadItemFromTool(
          { prisma: prisma as never },
          { ...scope, itemId: existing.id, proof },
        ),
      ).resolves.toMatchObject({ item: { proof } });
    }
  });

  it("rejects proof downgrade, clear, arbitrary stamps, and repark with changed proof", async () => {
    const rejected = [
      { oldProof: null, proof: effectKey },
      { oldProof: "zernio:post-1", proof: effectKey },
      { oldProof: "https://social.example/post/1", proof: "https://social.example/post/2" },
      { oldProof: "zernio:post-1", proof: null },
    ] as const;
    for (const { oldProof, proof } of rejected) {
      const existing = row({ proof: oldProof, status: "open", approvedAt: now });
      const prisma = prismaWith({ findFirst: vi.fn(async () => existing) });
      await expect(
        updateScratchpadItemFromTool({ prisma: prisma as never }, {
          ...scope,
          itemId: existing.id,
          proof,
        } as never),
      ).resolves.toMatchObject({ error: expect.any(String) });
    }

    const approved = row({ proof: effectKey, status: "open", approvedAt: now, approvedBy: "user" });
    const repark = prismaWith({ findFirst: vi.fn(async () => approved) });
    await expect(
      updateScratchpadItemFromTool(
        { prisma: repark as never },
        {
          ...scope,
          itemId: approved.id,
          status: "parked",
          proof: "zernio:post-1",
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("approves only the rendered parked version, invalidates approval after founder edits, and limits reapproval to stamps", async () => {
    const parked = row();
    const stale = prismaWith({
      findFirst: vi.fn(async () => parked),
      updateMany: vi.fn(async () => ({ count: 0 })),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: stale as never },
        {
          ...scope,
          itemId: parked.id,
          status: "open",
          updatedAt: "2026-08-25T11:59:00.000Z",
        },
      ),
    ).resolves.toMatchObject({ conflict: true });
    expect(stale.scratchpadItem.updateMany).not.toHaveBeenCalled();

    const raced = prismaWith({
      findFirst: vi.fn(async () => parked),
      updateMany: vi.fn(async () => ({ count: 0 })),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: raced as never },
        {
          ...scope,
          itemId: parked.id,
          status: "open",
          updatedAt: parked.updatedAt.toISOString(),
        },
      ),
    ).resolves.toMatchObject({ conflict: true });
    expect(raced.scratchpadItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ...scope,
          id: parked.id,
          status: "parked",
          approvedAt: null,
          updatedAt: parked.updatedAt,
        }),
      }),
    );

    const noVersion = prismaWith({ findFirst: vi.fn(async () => parked) });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: noVersion as never },
        {
          ...scope,
          itemId: parked.id,
          status: "open",
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });

    const approved = row({ status: "parked", updatedAt: now });
    const approve = prismaWith({
      findFirst: vi.fn(async () => approved),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await updateScratchpadItemFromUser(
      { prisma: approve as never },
      {
        ...scope,
        itemId: approved.id,
        status: "open",
        updatedAt: now.toISOString(),
      },
    );
    expect(approve.scratchpadItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "open",
          approvedAt: expect.any(Date),
          approvedBy: "user",
        }),
      }),
    );

    const urlProof = prismaWith({
      findFirst: vi.fn(async () =>
        row({ status: "parked", proof: "https://social.example/post/1" }),
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: urlProof as never },
        {
          ...scope,
          itemId: "item-1",
          status: "open",
          updatedAt: now.toISOString(),
        },
      ),
    ).resolves.toMatchObject({ item: expect.any(Object) });

    const approvedOpen = row({ status: "open", approvedAt: now, approvedBy: "user" });
    const founderEdit = prismaWith({
      findFirst: vi.fn(async () => approvedOpen),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await updateScratchpadItemFromUser(
      { prisma: founderEdit as never },
      {
        ...scope,
        itemId: approvedOpen.id,
        title: "Edited approved copy",
      },
    );
    expect(founderEdit.scratchpadItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "parked", approvedAt: null, approvedBy: null }),
      }),
    );

    const stamped = row({ status: "parked", proof: effectKey });
    const reapprove = prismaWith({
      findFirst: vi.fn(async () => stamped),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await updateScratchpadItemFromUser(
      { prisma: reapprove as never },
      {
        ...scope,
        itemId: stamped.id,
        reapprove: true,
        updatedAt: now.toISOString(),
      },
    );
    expect(reapprove.scratchpadItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "open", proof: null, approvedBy: "user" }),
      }),
    );
    for (const proof of ["zernio:post-1", "https://social.example/post/1"]) {
      const cannotClear = prismaWith({
        findFirst: vi.fn(async () => row({ status: "parked", proof })),
      });
      await expect(
        updateScratchpadItemFromUser(
          { prisma: cannotClear as never },
          {
            ...scope,
            itemId: "item-1",
            reapprove: true,
            updatedAt: now.toISOString(),
          },
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
    }
    const stampedOpen = prismaWith({
      findFirst: vi.fn(async () =>
        row({ status: "open", proof: effectKey, approvedAt: now, approvedBy: "user" }),
      ),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: stampedOpen as never },
        {
          ...scope,
          itemId: "item-1",
          status: "open",
          updatedAt: now.toISOString(),
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
    const stampedParked = prismaWith({
      findFirst: vi.fn(async () => row({ status: "parked", proof: effectKey })),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: stampedParked as never },
        {
          ...scope,
          itemId: "item-1",
          status: "open",
          updatedAt: now.toISOString(),
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
    const combined = prismaWith({ findFirst: vi.fn(async () => parked) });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: combined as never },
        {
          ...scope,
          itemId: "item-1",
          status: "open",
          title: "approve and edit",
          updatedAt: now.toISOString(),
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });

    const email = prismaWith({
      findFirst: vi.fn(async () =>
        row({ category: "outbound_email", channel: "email", status: "parked" }),
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: email as never },
        {
          ...scope,
          itemId: "item-1",
          status: "done",
          proof: "gmail:item-1",
        },
      ),
    ).resolves.toMatchObject({ item: expect.any(Object) });
  });

  it("returns a conflict when approval uses a version made stale by an already-applied approval", async () => {
    const current = row({
      status: "open",
      approvedAt: new Date(now.getTime() + 1_000),
      approvedBy: "user",
      updatedAt: new Date(now.getTime() + 1_000),
    });
    const prisma = prismaWith({
      findFirst: vi.fn(async () => current),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      updateScratchpadItemFromUser(
        { prisma: prisma as never },
        {
          ...scope,
          itemId: current.id,
          status: "open",
          updatedAt: now.toISOString(),
        },
      ),
    ).resolves.toEqual({ conflict: true });
  });

  it("serializes non-done goal creation and blocks a second goal even when parked", async () => {
    const prisma = prismaWith({
      findFirst: vi.fn(async () => row({ category: "goal", status: "parked" })),
    });
    await expect(
      addScratchpadItemFromTool(
        { prisma: prisma as never },
        {
          ...scope,
          title: "Second goal",
          category: "goal",
        },
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.executeRaw).toHaveBeenCalledOnce();
  });

  it("supports approved signup and post gates", async () => {
    for (const [category, gate] of [
      ["create_account", hasApprovedOpenSignup],
      ["public_post", hasApprovedOpenPost],
    ] as const) {
      const findFirst = vi.fn(async () =>
        row({ category, status: "open", approvedAt: now, proof: null }),
      );
      await expect(
        gate({ prisma: { scratchpadItem: { findFirst } } as never }, scope),
      ).resolves.toBe(true);
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ...scope,
            category,
            status: "open",
            approvedAt: { not: null },
            ...(category === "public_post" ? { proof: null } : {}),
          }),
        }),
      );
    }
  });

  it("closes the built-in scratchpad schemas to unknown properties", () => {
    for (const name of ["scratchpad_add", "scratchpad_update", "scratchpad_complete"]) {
      const tool = builtinAgentTools.find((candidate) => candidate.name === name);
      expect(tool?.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }
  });

  it("consumes the exact approved post once, supports same-key replay, and clears only that stamp", async () => {
    const candidate = row({ status: "open", approvedAt: now, proof: null });
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(candidate)
      .mockResolvedValueOnce(row({ ...candidate, proof: effectKey }));
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = prismaWith({ findFirst, updateMany });
    const input = {
      ...scope,
      text: "Exact post",
      scheduledFor: "2026-08-25T13:00:00+00:00",
      target: "account-1",
      effectKey,
      now: () => now,
    };
    await expect(consumeApprovedPost({ prisma: prisma as never }, input)).resolves.toMatchObject({
      count: 1,
      item: expect.objectContaining({ channel: "x", target: "account-1" }),
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ...scope,
          id: candidate.id,
          status: "open",
          approvedAt: candidate.approvedAt,
          approvedBy: candidate.approvedBy,
          updatedAt: candidate.updatedAt,
          proof: null,
        }),
        data: expect.objectContaining({ proof: effectKey }),
      }),
    );
    await expect(consumeApprovedPost({ prisma: prisma as never }, input)).resolves.toMatchObject({
      count: 1,
      item: expect.objectContaining({ id: candidate.id }),
    });
    await expect(
      consumeApprovedPost(
        { prisma: prisma as never },
        {
          ...input,
          scheduledFor: "2026-08-25T12:59:00Z",
        },
      ),
    ).resolves.toEqual({ count: 0 });

    const clear = prismaWith({ updateMany });
    await expect(
      clearPostStamp({ prisma: clear as never }, { ...scope, itemId: candidate.id, effectKey }),
    ).resolves.toBe(true);
    expect(clear.scratchpadItem.updateMany).toHaveBeenCalledWith({
      where: { ...scope, id: candidate.id, proof: effectKey },
      data: { proof: null },
    });
    await expect(
      clearPostStamp(
        { prisma: clear as never },
        { ...scope, itemId: candidate.id, effectKey: "zernio:post-1" },
      ),
    ).resolves.toBe(false);
  });

  it("fails closed on invalid post arguments and excludes future stamped posts from work", async () => {
    const prisma = prismaWith({ findFirst: vi.fn(async () => null) });
    for (const effectKey of ["", "raw-key", "https://proof.example", "zernio:post-1"]) {
      await expect(
        consumeApprovedPost(
          { prisma: prisma as never },
          {
            ...scope,
            text: "copy",
            scheduledFor: "2026-08-25T13:00:00Z",
            target: "account-1",
            effectKey,
            now: () => now,
          },
        ),
      ).resolves.toEqual({ count: 0 });
    }
    const candidate = row({ status: "open", approvedAt: now, proof: null });
    const unknownOverride = prismaWith({
      findFirst: vi.fn(async () => candidate),
      updateMany: vi.fn(async () => ({ count: 1 })),
    });
    await expect(
      consumeApprovedPost({ prisma: unknownOverride as never }, {
        ...scope,
        text: "copy",
        scheduledFor: "2026-08-25T13:00:00Z",
        target: "account-1",
        effectKey,
        now: () => now,
        publishNow: true,
      } as never),
    ).resolves.toEqual({ count: 0 });
    expect(unknownOverride.$transaction).not.toHaveBeenCalled();

    const findMany = vi.fn(async () => [
      row({
        id: "later",
        status: "open",
        createdAt: new Date("2026-08-25T11:00Z"),
        proof: "zernio:id",
        scheduledFor: new Date("2026-08-25T13:00Z"),
      }),
      row({
        id: "earlier",
        category: "research",
        status: "open",
        createdAt: new Date("2026-08-25T10:00Z"),
        proof: null,
      }),
    ]);
    const work = prismaWith({ findMany });
    await expect(
      findWorkableOpenItem({ prisma: work as never }, scope, () => now),
    ).resolves.toMatchObject({ id: "earlier" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...scope, status: "open" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("keeps remove and list wrapper scoped", async () => {
    const prisma = prismaWith({
      findFirst: vi.fn(async () => row({ category: null })),
    });
    await removeScratchpadItemFromTool({ prisma: prisma as never }, { ...scope, itemId: "item-1" });
    expect(prisma.scratchpadItem.deleteMany).toHaveBeenCalledWith({
      where: { ...scope, id: "item-1", updatedAt: now, category: null },
    });
    const result = await listScratchpadItemsFromTool({ prisma: prisma as never }, scope);
    expect(result.items).toEqual([]);
  });

  it("does not allow an agent to remove any gated category", async () => {
    const gatedRows = [
      row({
        category: "public_post",
        status: "open",
        proof: effectKey,
        approvedAt: now,
        approvedBy: "user",
      }),
      row({
        category: "create_account",
        status: "parked",
        proof: "https://example.test/signup",
        approvedAt: now,
        approvedBy: "user",
      }),
      row({
        category: "outbound_email",
        status: "done",
        proof: "gmail:item-1",
        approvedAt: now,
        approvedBy: "user",
      }),
    ];
    for (const candidate of gatedRows) {
      const prisma = prismaWith({ findFirst: vi.fn(async () => candidate) });
      await expect(
        removeScratchpadItemFromTool(
          { prisma: prisma as never },
          { ...scope, itemId: candidate.id },
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
      expect(prisma.scratchpadItem.deleteMany).not.toHaveBeenCalled();
    }
  });

  it("allows a founder to discard gated work with a scoped version and category guard", async () => {
    const candidate = row({
      status: "done",
      proof: "https://social.example/post/1",
      approvedAt: now,
      approvedBy: "user",
    });
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const prisma = prismaWith({
      findFirst: vi.fn(async () => candidate),
      deleteMany,
    });
    await expect(
      removeScratchpadItemFromUser({ prisma: prisma as never }, { ...scope, itemId: candidate.id }),
    ).resolves.toMatchObject({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        ...scope,
        id: candidate.id,
        updatedAt: candidate.updatedAt,
        category: "public_post",
      },
    });
  });

  it("allows agent removal of plain, research, and draft items with a scoped guard", async () => {
    for (const category of [null, "research", "draft"]) {
      const candidate = row({ category, status: "done" });
      const deleteMany = vi.fn(async () => ({ count: 1 }));
      const prisma = prismaWith({
        findFirst: vi.fn(async () => candidate),
        deleteMany,
      });
      await expect(
        removeScratchpadItemFromTool(
          { prisma: prisma as never },
          { ...scope, itemId: candidate.id },
        ),
      ).resolves.toMatchObject({ ok: true });
      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          ...scope,
          id: candidate.id,
          updatedAt: candidate.updatedAt,
          category,
        },
      });
    }
  });

  it("returns the changed retry error when guarded removal matches no row", async () => {
    const candidate = row({ category: null });
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const prisma = prismaWith({
      findFirst: vi.fn(async () => candidate),
      deleteMany,
    });
    await expect(
      removeScratchpadItemFromTool({ prisma: prisma as never }, { ...scope, itemId: candidate.id }),
    ).resolves.toEqual({ error: "Scratchpad item changed; retry." });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        ...scope,
        id: candidate.id,
        updatedAt: candidate.updatedAt,
        category: null,
      },
    });
  });
});
