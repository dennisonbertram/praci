import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

// Offline boundary: a fake Prisma client drives the real handler and the real repos.getBot check.
// The stored snapshot, version and link are covered against PostgreSQL in the adapters package.
const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
} satisfies Actor;

const bots = [
  { id: "bot-1", userId: "user-1", spaceId: "space-1", archivedAt: null },
  { id: "bot-other-user", userId: "user-2", spaceId: "space-1", archivedAt: null },
  { id: "bot-other-space", userId: "user-1", spaceId: "space-2", archivedAt: null },
];

function setup() {
  const botPage = { findFirst: vi.fn(async () => null) };
  const artifact = { create: vi.fn() };
  const prisma = {
    bot: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const bot = bots.find((entry) =>
          Object.entries(args.where).every(
            ([key, value]) =>
              key === "archivedAt" || (entry as Record<string, unknown>)[key] === value,
          ),
        );
        return bot ? { ...bot, thread: null, computer: null } : null;
      }),
    },
    botPage,
    artifact,
  };
  const put = vi.fn();
  const handler = new RPCHandler(
    createRouter({
      prisma: prisma as unknown as PrismaClient,
      artifacts: { put },
      secrets: {},
      env: { webOrigin: "http://127.0.0.1:5173" },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps),
  );
  async function share(input: unknown) {
    const { response } = await handler.handle(
      new Request("http://127.0.0.1/rpc/pages/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    if (!response) throw new Error("Procedure did not match");
    return { status: response.status, body: await response.json() };
  }
  return { botPage, artifact, put, share };
}

describe("pages.share", () => {
  it("rejects another user's or space's bot and stores nothing", async () => {
    const { botPage, artifact, put, share } = setup();
    for (const botId of ["bot-other-user", "bot-other-space", "missing"]) {
      expect((await share({ botId })).status).toBeGreaterThanOrEqual(400);
    }
    expect(botPage.findFirst).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(artifact.create).not.toHaveBeenCalled();
  });

  it("returns null for a page that is not this bot's and stores nothing", async () => {
    const { botPage, artifact, put, share } = setup();
    const result = await share({ botId: "bot-1", pageId: "page-of-another-bot" });
    expect(result.status).toBe(200);
    expect(result.body.json).toBeNull();
    expect(botPage.findFirst).toHaveBeenCalledOnce();
    expect(put).not.toHaveBeenCalled();
    expect(artifact.create).not.toHaveBeenCalled();
  });
});
