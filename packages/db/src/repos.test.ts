import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { createRepos } from "./repos.js";
import { IsolationError } from "./scope.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "ws-1",
  email: "test@example.com",
  isDeploymentOwner: false,
};

const baseBot = {
  id: "bot-1",
  spaceId: "ws-1",
  userId: "user-1",
  name: "Test Bot",
  title: "",
  description: "",
  instructions: "",
  color: "#000",
  notifyOnFinish: true,
  pinned: false,
  position: 0,
  sectionId: null,
  archivedAt: null,
  parentBotId: null,
  memoryScope: null as string | null,
  createdAt: new Date("2026-08-19T00:00:00.000Z"),
  updatedAt: new Date("2026-08-19T00:00:00.000Z"),
  thread: { id: "thread-1", unread: false, messages: [], runs: [] },
  runs: [],
  computer: null,
};

function reposFor(memoryScope: string | null) {
  const prisma = {
    bot: {
      findMany: vi.fn(async () => [{ ...baseBot, memoryScope }]),
    },
    run: {
      findMany: vi.fn(async () => []),
    },
    $queryRaw: vi.fn(async () => []),
  };
  return createRepos(prisma as unknown as PrismaClient);
}

/** Rows of the per-thread preview query, newest first, as the database returns them. */
function previewRows(
  messages: Array<{
    id?: string;
    role?: string;
    replyToMessageId?: string;
    runId?: string;
    blocks: unknown[];
  }>,
  threadId = "thread-1",
) {
  return messages.map((message, index) => ({
    threadId,
    seq: messages.length - index,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    ...message,
  }));
}

describe("createRepos.listBots", () => {
  it("surfaces a failed foreground run and clears the signal after recovery", async () => {
    const findMany = vi.fn(async () => [baseBot]);
    const queryRaw = vi.fn(async () => [] as unknown[]);
    queryRaw.mockResolvedValueOnce([{ id: "run-failed", threadId: "thread-1", status: "failed" }]);
    const repos = createRepos({
      bot: { findMany },
      run: { findMany: async () => [] },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient);
    const failed = await repos.listBots(actor);
    expect(failed[0]).toMatchObject({ status: "idle", runErrorId: "run-failed" });
    queryRaw.mockResolvedValueOnce([
      { id: "run-recovered", threadId: "thread-1", status: "completed" },
    ]);
    const recovered = await repos.listBots(actor);
    expect(recovered[0]).toMatchObject({ status: "idle", runErrorId: null });
  });

  it("passes memoryScope through as null when unset", async () => {
    await expect(reposFor(null).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ memoryScope: null }),
    ]);
  });

  it("passes memoryScope through when set to shared", async () => {
    await expect(reposFor("shared").listBots(actor)).resolves.toEqual([
      expect.objectContaining({ memoryScope: "shared" }),
    ]);
  });

  it("classifies initial preview runs once across bots, including non-peer results", async () => {
    const prisma = {
      bot: {
        findMany: vi.fn(async () =>
          ["one", "two"].map((id) => ({
            ...baseBot,
            id,
            thread: { ...baseBot.thread, id: `thread-${id}`, messages: [] },
          })),
        ),
      },
      run: { findMany: vi.fn(async (_args?: unknown) => []) },
      $queryRaw: vi.fn(async () =>
        ["one", "two"].map((id, seq) => ({
          threadId: `thread-${id}`,
          seq,
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          runId: `run-${id}`,
          blocks: [{ kind: "text", text: `Answer ${id}` }],
        })),
      ),
    };

    const bots = await createRepos(prisma as unknown as PrismaClient).listBots(actor);

    expect(bots.map((bot) => bot.preview)).toEqual(["Answer one", "Answer two"]);
    expect(prisma.run.findMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["run-one", "run-two"] }, trigger: { in: ["bot_message", "tickets"] } },
      select: { id: true, trigger: true },
    });
  });

  it("previews the latest words, not an emoji reaction or a card after them", async () => {
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      run: { findMany: vi.fn(async (_args?: unknown) => []) },
      $queryRaw: vi.fn(async () =>
        previewRows([
          { id: "m3", role: "bot", blocks: [{ kind: "choice", question: "Pick" }] },
          {
            id: "m2",
            role: "user",
            replyToMessageId: "m1",
            blocks: [{ kind: "text", text: "👍" }],
          },
          { id: "m1", role: "bot", blocks: [{ kind: "text", text: "Done." }] },
        ]),
      ),
    };

    const bots = await createRepos(prisma as unknown as PrismaClient).listBots(actor);

    expect(bots[0]?.preview).toBe("Done.");
  });

  it("classifies unseen runs in older pages and retains negative results between pages", async () => {
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: "peer-new" }])
          .mockResolvedValueOnce([{ id: "peer-old" }])
          .mockResolvedValue([]),
      },
      $queryRaw: vi.fn(async () => [
        {
          threadId: "thread-1",
          seq: 30,
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          runId: "peer-new",
          blocks: [{ kind: "text", text: "Hidden" }],
        },
      ]),
      message: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { seq: 20, runId: "peer-old", blocks: [{ kind: "text", text: "Also hidden" }] },
            { seq: 19, runId: "user-old", blocks: [] },
          ])
          .mockResolvedValueOnce([
            { seq: 10, runId: "peer-old", blocks: [{ kind: "text", text: "Still hidden" }] },
            { seq: 9, runId: "user-old", blocks: [{ kind: "text", text: "Visible answer" }] },
          ]),
      },
    };

    const bots = await createRepos(prisma as unknown as PrismaClient).listBots(actor);

    expect(bots[0]?.preview).toBe("Visible answer");
    expect(prisma.run.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ["peer-old", "user-old"] },
        trigger: { in: ["bot_message", "tickets"] },
      },
      select: { id: true, trigger: true },
    });
    expect(prisma.message.findMany).toHaveBeenCalledTimes(2);
  });

  it("keeps bot-to-bot run output out of sidebar previews", async () => {
    const findMany = vi.fn(async () => [
      {
        ...baseBot,
        thread: { ...baseBot.thread, messages: [] },
      },
    ]);
    const prisma = {
      bot: {
        findMany,
      },
      run: {
        findMany: vi.fn(async () => [{ id: "run-peer" }]),
      },
      $queryRaw: vi.fn(async () => [
        {
          threadId: "thread-1",
          seq: 3,
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          runId: "run-peer",
          blocks: [{ kind: "text", text: "Echoed peer reply" }],
        },
        {
          threadId: "thread-1",
          seq: 2,
          createdAt: new Date("2026-08-19T00:00:00.000Z"),
          runId: "run-peer",
          blocks: [
            {
              kind: "bot_message_received",
              fromBotId: "bot-2",
              fromBotName: "Coder",
              text: "Peer result",
            },
          ],
        },
        {
          threadId: "thread-1",
          seq: 1,
          createdAt: new Date("2026-08-18T00:00:00.000Z"),
          runId: "run-user",
          blocks: [{ kind: "text", text: "Visible answer" }],
        },
      ]),
    };

    await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Visible answer" }),
    ]);
  });

  it("previews the last visible message, never a delegate's collapsed receipt", async () => {
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      run: {
        findMany: vi.fn(async () => [{ id: "run-peer" }]),
      },
      $queryRaw: vi.fn(async () =>
        previewRows([
          {
            runId: "run-peer",
            blocks: [
              {
                kind: "bot_message_received",
                fromBotId: "bot-2",
                fromBotName: "Finance",
                text: "Burn is $10 a month.",
                intent: "result",
                returnToMessageId: "m-sent",
              },
            ],
          },
          { runId: "run-user", blocks: [{ kind: "text", text: "Ask Finance for burn." }] },
        ]),
      ),
    };

    await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Ask Finance for burn." }),
    ]);
  });

  it("reads past a bare hand-off step and says Waiting for approval while the delegate waits", async () => {
    const handOff = {
      runId: "run-user",
      blocks: [{ kind: "steps", steps: [{ label: "Message bot", count: 1 }] }],
    };
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      $queryRaw: vi.fn(async () =>
        previewRows([
          handOff,
          { runId: "run-user", blocks: [{ kind: "text", text: "Pay Acme $300." }] },
        ]),
      ),
      run: {
        findMany: vi.fn(
          async (_args: { where: Record<string, unknown> }): Promise<unknown[]> => [],
        ),
      },
    };
    const repos = createRepos(prisma as unknown as PrismaClient);
    await expect(repos.listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Pay Acme $300." }),
    ]);

    prisma.run.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      args.where.status === "waiting_input"
        ? [
            {
              id: "run-mercury",
              taskId: "t1",
              threadId: "thread-m",
              botId: "bot-m",
              sourceMessage: {
                blocks: [
                  {
                    kind: "bot_message_received",
                    fromBotId: baseBot.id,
                    returnToMessageId: "m-sent",
                  },
                ],
              },
            },
          ]
        : [],
    );
    (prisma as unknown as { message: unknown }).message = {
      findMany: vi.fn(async () => [{ id: "m-sent" }]),
    };
    await expect(repos.listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Waiting for approval" }),
    ]);
  });

  it("says Waiting for approval even when the hand-off is older than the preview window", async () => {
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      $queryRaw: vi.fn(async () =>
        previewRows([{ runId: "run-user", blocks: [{ kind: "text", text: "Any news?" }] }]),
      ),
      run: {
        findMany: vi.fn(async (args: { where: Record<string, unknown> }) =>
          args.where.status === "waiting_input"
            ? [
                {
                  id: "run-mercury",
                  taskId: "t1",
                  threadId: "thread-m",
                  botId: "bot-m",
                  sourceMessage: {
                    blocks: [
                      {
                        kind: "bot_message_received",
                        fromBotId: baseBot.id,
                        returnToMessageId: "m-sent",
                      },
                    ],
                  },
                },
              ]
            : [],
        ),
      },
      message: { findMany: vi.fn(async () => [{ id: "m-sent" }]) },
    };
    await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Waiting for approval" }),
    ]);
  });

  it.each(["request", "question", "fyi", undefined] as const)(
    "never previews an instruction another agent delivered (intent %s)",
    async (intent) => {
      const prisma = {
        bot: {
          findMany: vi.fn(async () => [
            {
              ...baseBot,
              thread: { ...baseBot.thread, messages: [] },
            },
          ]),
        },
        run: {
          findMany: vi.fn(async () => [{ id: "run-peer" }]),
        },
        $queryRaw: vi.fn(async () =>
          previewRows([
            {
              runId: "run-peer",
              blocks: [
                {
                  kind: "bot_message_received",
                  fromBotId: "bot-2",
                  fromBotName: "Chief",
                  text: "Please send 3,200 dollars to Acme.",
                  intent,
                  returnToMessageId: "m-sent",
                },
              ],
            },
            { runId: "run-user", blocks: [{ kind: "text", text: "Pay Acme." }] },
          ]),
        ),
      };

      await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual(
        [expect.objectContaining({ preview: "Pay Acme." })],
      );
    },
  );

  it("skips a peer-run preview tail when the receipt is outside the window", async () => {
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      run: {
        findMany: vi.fn(async () => [{ id: "run-peer" }]),
      },
      $queryRaw: vi.fn(async () => [
        {
          threadId: "thread-1",
          seq: 2,
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          runId: "run-peer",
          blocks: [{ kind: "text", text: "Echoed peer reply" }],
        },
        {
          threadId: "thread-1",
          seq: 1,
          createdAt: new Date("2026-08-19T00:00:00.000Z"),
          runId: "run-user",
          blocks: [{ kind: "text", text: "Visible answer" }],
        },
      ]),
      message: {
        findMany: vi.fn(async () => []),
      },
    };

    await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Visible answer" }),
    ]);
  });

  it("scans older messages when the newest window is only peer output", async () => {
    const messageFindMany = vi.fn(async () => [
      { seq: 1, runId: "run-user", blocks: [{ kind: "text", text: "Older visible answer" }] },
    ]);
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      run: {
        findMany: vi.fn(async () => [{ id: "run-peer" }]),
      },
      $queryRaw: vi.fn(async () => [
        {
          threadId: "thread-1",
          seq: 20,
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          runId: "run-peer",
          blocks: [{ kind: "text", text: "Echoed peer reply" }],
        },
      ]),
      message: {
        findMany: messageFindMany,
      },
    };

    await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Older visible answer" }),
    ]);
    expect(messageFindMany).toHaveBeenCalledWith({
      where: { threadId: "thread-1", seq: { lt: 20 } },
      orderBy: { seq: "desc" },
      take: 16,
    });
  });

  it("uses a visible message from the fourth older window for preview", async () => {
    const peerWindows = [
      [{ seq: 80, runId: "run-peer", blocks: [{ kind: "text", text: "peer 80" }] }],
      [{ seq: 60, runId: "run-peer", blocks: [{ kind: "text", text: "peer 60" }] }],
      [{ seq: 40, runId: "run-peer", blocks: [{ kind: "text", text: "peer 40" }] }],
      [{ seq: 20, runId: "run-peer", blocks: [{ kind: "text", text: "peer 20" }] }],
      [{ seq: 1, runId: "run-user", blocks: [{ kind: "text", text: "Fourth-window answer" }] }],
    ];
    let windowIndex = 0;
    const messageFindMany = vi.fn(async () => {
      windowIndex += 1;
      return peerWindows[windowIndex] ?? [];
    });
    const prisma = {
      bot: {
        findMany: vi.fn(async () => [
          {
            ...baseBot,
            thread: { ...baseBot.thread, messages: [] },
          },
        ]),
      },
      run: {
        findMany: vi.fn(async () => [{ id: "run-peer" }]),
      },
      $queryRaw: vi.fn(async () =>
        (peerWindows[0] ?? []).map((message) => ({
          threadId: "thread-1",
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          ...message,
        })),
      ),
      message: {
        findMany: messageFindMany,
      },
    };

    await expect(createRepos(prisma as unknown as PrismaClient).listBots(actor)).resolves.toEqual([
      expect.objectContaining({ preview: "Fourth-window answer" }),
    ]);
    expect(messageFindMany).toHaveBeenCalledTimes(4);
  });
});

describe("createRepos.listSpaceBotsForSpaces", () => {
  it("loads and maps only the compact cross-space sidebar fields", async () => {
    const findMany = vi.fn(async (_query: { where: unknown; select: Record<string, unknown> }) => [
      {
        id: "bot-2",
        spaceId: "ws-2",
        name: "Support",
        title: "Customer support",
        color: "#123456",
        notifyOnFinish: false,
        pinned: true,
        sectionId: null,
        updatedAt: new Date("2026-08-20T00:00:00.000Z"),
        parentBotId: null,
        thread: {
          id: "thread-2",
          unread: true,
          runs: [{ id: "run-failed", status: "failed" }],
        },
        runs: [{ status: "running" }],
      },
    ]);
    const repos = createRepos({
      bot: { findMany },
      run: { findMany: async () => [] },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ id: "run-failed", threadId: "thread-2", status: "failed" }])
        .mockResolvedValueOnce([
          {
            id: "message-2",
            threadId: "thread-2",
            seq: 4,
            role: "user",
            blocks: [{ kind: "text", text: "Waiting for a reply" }],
            botId: null,
            replyToMessageId: null,
            replyQuote: null,
            runId: null,
            clientNonce: null,
            createdAt: new Date("2026-08-19T12:00:00.000Z"),
          },
        ]),
    } as unknown as PrismaClient);

    await expect(repos.listSpaceBotsForSpaces(actor, ["ws-2"])).resolves.toEqual([
      {
        id: "bot-2",
        spaceId: "ws-2",
        name: "Support",
        title: "Customer support",
        color: "#123456",
        notifyOnFinish: false,
        pinned: true,
        hiddenAt: null,
        sectionId: null,
        unread: true,
        parentBotId: null,
        preview: "Waiting for a reply",
        status: "running",
        runPhase: null,
        runErrorId: "run-failed",
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
    ]);
    const query = findMany.mock.calls[0]![0];
    expect(query.select.thread).toEqual(
      expect.objectContaining({
        select: expect.not.objectContaining({
          messages: expect.anything(),
        }),
      }),
    );
    expect(query.where).toEqual(
      expect.objectContaining({ spaceId: { in: ["ws-2"] }, userId: actor.userId }),
    );
    expect(query.select).not.toHaveProperty("description");
    expect(query.select).not.toHaveProperty("instructions");
    expect(query.select).not.toHaveProperty("computer");
  });
});

describe("createRepos.reorderBots", () => {
  function reorderRepos(ids: string[]) {
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      bot: {
        findMany: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))),
        update,
      },
    };
    const prisma = {
      $transaction: vi.fn((run: (client: typeof tx) => Promise<void>) => run(tx)),
    };
    return { repos: createRepos(prisma as unknown as PrismaClient), update };
  }

  it("writes each owned bot's requested position", async () => {
    const { repos, update } = reorderRepos(["bot-1", "bot-2"]);
    await repos.reorderBots(actor, ["bot-2", "bot-1"]);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "bot-2" },
      data: { position: 0 },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: "bot-1" },
      data: { position: 1 },
    });
  });

  it("rejects partial or foreign bot lists before writing", async () => {
    const { repos, update } = reorderRepos(["bot-1", "bot-2"]);
    await expect(repos.reorderBots(actor, ["bot-1"])).rejects.toBeInstanceOf(IsolationError);
    await expect(repos.reorderBots(actor, ["bot-1", "foreign"])).rejects.toBeInstanceOf(
      IsolationError,
    );
    expect(update).not.toHaveBeenCalled();
  });
});
