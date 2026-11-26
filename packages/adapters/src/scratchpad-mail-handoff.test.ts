import { describe, expect, it, vi } from "vitest";
import { addScratchpadItemFromTool } from "./scratchpad-tools.js";

const scope = { spaceId: "sp", userId: "u1", botId: "mailbot" };
const mailKey = "mail-thread:conn1:thr1";

function fake(opts: { owner?: boolean; message?: boolean; createError?: unknown } = {}) {
  const now = new Date();
  return {
    bot: {
      findFirst: vi.fn(async (_a: unknown) =>
        opts.owner === false ? null : { id: "cartabot", name: "Carta agent" },
      ),
    },
    cachedMailMessage: {
      findFirst: vi.fn(async (_a: unknown) =>
        opts.message === false ? null : { providerMessageId: "m9" },
      ),
    },
    scratchpadItem: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (opts.createError) throw opts.createError;
        return {
          id: "i1",
          notes: "",
          category: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
      }),
    },
  };
}

const add = (prisma: ReturnType<typeof fake>, extra: Record<string, unknown>) =>
  addScratchpadItemFromTool({ prisma: prisma as never }, {
    ...scope,
    title: "Get the change into Carta",
    ...extra,
  } as never);

describe("scratchpad_add from an email chat", () => {
  it("links the item to the thread from the run, not the model", async () => {
    const prisma = fake();
    await add(prisma, { callerSpawnKey: mailKey });
    expect(prisma.cachedMailMessage.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { spaceId: "sp", userId: "u1", connectionId: "conn1", threadId: "thr1" },
    });
    expect(prisma.scratchpadItem.create.mock.calls[0]?.[0].data).toMatchObject({
      botId: "mailbot",
      mailConnectionId: "conn1",
      mailThreadId: "thr1",
      mailMessageId: "m9",
    });
  });

  it("hands the item to the owning agent once, with the email link", async () => {
    const prisma = fake();
    const result = await add(prisma, { callerSpawnKey: mailKey, forAgent: "carta" });
    expect(prisma.bot.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { spaceId: "sp", userId: "u1", spawnKey: "carta-agent:u1", archivedAt: null },
    });
    expect(prisma.scratchpadItem.create).toHaveBeenCalledTimes(1);
    expect(prisma.scratchpadItem.create.mock.calls[0]?.[0].data).toMatchObject({
      botId: "cartabot",
      mailThreadId: "thr1",
    });
    expect(result).toMatchObject({ addedTo: "Carta agent" });
  });

  it("marks a handed-off item as waiting on the person unless the model named someone", async () => {
    const handed = fake();
    await add(handed, { callerSpawnKey: mailKey, forAgent: "carta" });
    expect(handed.scratchpadItem.create.mock.calls[0]?.[0].data).toMatchObject({
      waitingOn: "you",
    });
    const named = fake();
    await add(named, { callerSpawnKey: mailKey, forAgent: "carta", waitingOn: "Acme legal" });
    expect(named.scratchpadItem.create.mock.calls[0]?.[0].data).toMatchObject({
      waitingOn: "Acme legal",
    });
  });

  it("keeps the item on the email chat bot when no owning agent exists", async () => {
    const prisma = fake({ owner: false });
    const result = await add(prisma, { callerSpawnKey: mailKey, forAgent: "carta" });
    expect(prisma.scratchpadItem.create.mock.calls[0]?.[0].data).toMatchObject({
      botId: "mailbot",
      mailThreadId: "thr1",
    });
    expect(result).not.toHaveProperty("addedTo");
  });

  it("rejects a target that is not a known area, so no bot id can be steered", async () => {
    const prisma = fake();
    await expect(
      add(prisma, { callerSpawnKey: mailKey, forAgent: "other-bot-id" }),
    ).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(prisma.scratchpadItem.create).not.toHaveBeenCalled();
  });

  it("refuses forAgent outside an email chat and adds no mail link", async () => {
    const prisma = fake();
    await expect(
      add(prisma, { callerSpawnKey: "bot:x", forAgent: "carta" }),
    ).resolves.toMatchObject({
      error: expect.any(String),
    });
    await add(prisma, { callerSpawnKey: null });
    expect(prisma.scratchpadItem.create.mock.calls[0]?.[0].data).not.toHaveProperty("mailThreadId");
  });

  it("does not link a thread the owner has no cached mail for", async () => {
    const prisma = fake({ message: false });
    await add(prisma, { callerSpawnKey: mailKey });
    expect(prisma.scratchpadItem.create.mock.calls[0]?.[0].data).not.toHaveProperty("mailThreadId");
  });

  it("explains a second open to-do for the same email on the same agent", async () => {
    const prisma = fake({ createError: { code: "P2002" } });
    await expect(
      add(prisma, { callerSpawnKey: mailKey, forAgent: "carta" }),
    ).resolves.toMatchObject({
      error: expect.stringContaining("already has an open to-do"),
    });
  });
});
