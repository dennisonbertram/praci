import type * as db from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import {
  chooseFocus,
  dismissPendingChoiceInTransaction,
  markAppConnected,
  seedBlankBotGreeting,
} from "./onboarding.js";

const posted = vi.hoisted(() => [] as Array<{ blocks: unknown[] }>);
vi.mock("@rakazo/db", async (original) => ({
  ...(await original<typeof db>()),
  createThreadMessageInTransaction: vi.fn(async (_tx, input) => {
    posted.push(input);
    return { id: "posted" };
  }),
  appendEventInTransaction: vi.fn(async () => ({ seq: 1 })),
}));
function fixture(catalog: unknown[]) {
  posted.length = 0;
  const tx = {
    $executeRaw: vi.fn(),
    message: {
      findMany: vi.fn(async () => [{ id: "choice", blocks: [{ kind: "choice", answerId: null }] }]),
      update: vi.fn(),
    },
  };
  const deps = {
    prisma: {
      bot: { findFirst: vi.fn(async () => ({ id: "bot", thread: { id: "thread" } })) },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
    events: { notify: vi.fn() },
    connectors: { managedProviders: () => [{ catalog: async () => catalog }] },
  } as unknown as Parameters<typeof chooseFocus>[0];
  const actor = {
    userId: "user",
    spaceId: "space",
    email: "user@rakazo.test",
    isDeploymentOwner: true,
  };
  return { deps, actor, tx };
}
describe("onboarding connection suggestions", () => {
  it("does not invent authorization cards when no connector has an app catalog", async () => {
    const { deps, actor } = fixture([]);
    await chooseFocus(deps, actor, "bot", "day");
    expect(posted.flatMap((message) => message.blocks)).not.toContainEqual(
      expect.objectContaining({ kind: "app_connect" }),
    );
    expect(posted.length).toBeGreaterThan(0);
  });
  it("uses the available connector and omits unavailable apps", async () => {
    const { deps, actor } = fixture([
      { connectorId: "pipedream", slug: "slack", name: "Slack", connected: false, logo: null },
    ]);
    await chooseFocus(deps, actor, "bot", "day");
    expect(
      posted
        .flatMap((message) => message.blocks)
        .filter((block) => (block as { kind: string }).kind === "app_connect"),
    ).toEqual([
      expect.objectContaining({ connectorId: "pipedream", provider: "slack", name: "Slack" }),
    ]);
  });
});

it("marks only the authorized connector when provider slugs collide", async () => {
  const { deps, actor, tx } = fixture([]);
  const blocks = ["composio", "pipedream"].map((connectorId) => ({
    kind: "app_connect",
    connectorId,
    provider: "slack",
    name: "Slack",
    status: "pending",
  }));
  deps.prisma.message = { findMany: vi.fn(async () => [{ id: "cards", blocks }]) } as never;
  await markAppConnected(deps, actor, "bot", "slack", "pipedream");
  expect(tx.message.update).toHaveBeenCalledWith({
    where: { id: "cards" },
    data: { blocks: [blocks[0], { ...blocks[1], status: "connected" }] },
  });
});

describe("blank bot greeting", () => {
  it("posts a fixed greeting that names the user but not the soon-renamed bot", async () => {
    const { deps, actor } = fixture([]);
    (deps.prisma as unknown as { user: unknown }).user = {
      findUnique: vi.fn(async () => ({ name: "Ada Lovelace" })),
    };
    await seedBlankBotGreeting(deps, actor, { id: "bot", name: "New Bot", threadId: "thread" });
    expect(posted).toHaveLength(1);
    expect(posted[0]?.blocks).toEqual([
      {
        kind: "text",
        text: expect.stringMatching(/^Hi Ada\. I'm a blank slate/),
      },
    ]);
  });
});

describe("first bot greeting", () => {
  it("introduces what Chief does for the company without asking the focus card's question", async () => {
    const { deps, actor } = fixture([]);
    (deps.prisma as unknown as { user: unknown }).user = {
      findUnique: vi.fn(async () => ({ name: "Ada Lovelace" })),
    };
    await seedBlankBotGreeting(
      deps,
      actor,
      { id: "bot", name: "Chief", threadId: "thread" },
      { first: true },
    );
    const text = (posted[0]?.blocks[0] as { text: string } | undefined)?.text;
    expect(text).toMatch(/^Hi Ada, I'm Chief\. I can sort your email/);
    expect(text).not.toContain("?");
  });
});

describe("greeting without a name", () => {
  it("says Hi without the email handle that sign-up stored as the name", async () => {
    const { deps, actor } = fixture([]);
    (deps.prisma as unknown as { user: unknown }).user = {
      findUnique: vi.fn(async () => ({ name: "user" })),
    };
    await seedBlankBotGreeting(
      deps,
      actor,
      { id: "bot", name: "Chief", threadId: "thread" },
      { first: true },
    );
    const text = (posted[0]?.blocks[0] as { text: string } | undefined)?.text;
    expect(text).toMatch(/^Hi, I'm Chief\./);
  });
});

describe("company focus", () => {
  it("points to the Finance, Investors and Data room pages after the email cards", async () => {
    const { deps, actor } = fixture([
      { connectorId: "composio", slug: "gmail", name: "Gmail", connected: false, logo: null },
      {
        connectorId: "composio",
        slug: "googlecalendar",
        name: "Google Calendar",
        connected: false,
        logo: null,
      },
    ]);
    await chooseFocus(deps, actor, "bot", "company");
    const texts = posted.flatMap((message) =>
      message.blocks.flatMap((block) =>
        (block as { kind: string }).kind === "text" ? [(block as { text: string }).text] : [],
      ),
    );
    // One sentence above the cards, not three bubbles that all say connect.
    expect(texts[0]).toBe(
      "Connect Gmail and Google Calendar here and I’ll use what you already have.",
    );
    // One bubble and the cards.
    expect(texts).toHaveLength(1);
    expect(posted).toHaveLength(2);
  });
});

describe("focus choices", () => {
  it("offers four choices, with no second choice for the same apps as Day-to-day work", async () => {
    const { deps, actor } = fixture([]);
    await expect(chooseFocus(deps, actor, "bot", "inbox")).rejects.toThrow();
  });
  it("summarizes the company choice by what it connects", async () => {
    const { deps, actor } = fixture([]);
    await chooseFocus(deps, actor, "bot", "company");
    expect(posted[0]?.blocks[0]).toEqual({
      kind: "text",
      text: "Got it. Email, calendar, and your company pages.",
    });
  });
});

describe("answering the focus card by typing", () => {
  const target = { spaceId: "space", botId: "bot", threadId: "thread" };
  it("closes the open card once", async () => {
    const { tx } = fixture([]);
    const closed = await dismissPendingChoiceInTransaction(tx as never, target);
    expect(closed?.blocks).toEqual([{ kind: "choice", answerId: "_dismissed" }]);
    expect(tx.message.update).toHaveBeenCalledTimes(1);
  });
  it("does nothing when no card is open", async () => {
    const { tx } = fixture([]);
    tx.message.findMany.mockResolvedValueOnce([
      { id: "choice", blocks: [{ kind: "choice", answerId: "day" }] },
    ]);
    expect(await dismissPendingChoiceInTransaction(tx as never, target)).toBeNull();
    expect(tx.message.update).not.toHaveBeenCalled();
  });
});
