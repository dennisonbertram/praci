import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import { currentDbContext } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  userId: "user-one",
  spaceId: "space-one",
  email: "one@rakazo.test",
  isDeploymentOwner: true,
};

describe("disconnecting a model provider", () => {
  it("sends the owner's bots and routines pinned to it back to the default", async () => {
    const credential = {
      id: "cred-one",
      userId: actor.userId,
      provider: "anthropic",
      label: "Claude",
      secretId: "secret-one",
    };
    const contexts: Array<[string, string | undefined]> = [];
    const tx = {
      spaceBackupModel: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      userModelCredential: {
        findMany: vi.fn(async () => [credential]),
        deleteMany: vi.fn(async () => ({ count: 1 })),
        count: vi.fn(async () => 0),
      },
      userVoiceCredential: { count: vi.fn(async () => 0) },
      spaceModelPreference: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      $queryRaw: vi.fn(async () => [{ bypass: "off" }]),
      bot: {
        updateMany: vi.fn(async (_args: unknown) => {
          contexts.push(["bot", currentDbContext()?.kind]);
          return { count: 1 };
        }),
      },
      routine: {
        updateMany: vi.fn(async (_args: unknown) => {
          contexts.push(["routine", currentDbContext()?.kind]);
          return { count: 1 };
        }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const deps = {
      prisma,
      oauthLogins: { cancelProvider: vi.fn(async () => undefined) },
      env: { webOrigin: "http://127.0.0.1:5173", sandboxProvider: "fake" },
    } as unknown as RouterDeps;
    const handler = new RPCHandler(createRouter(deps));

    const { response } = await handler.handle(
      new Request("http://127.0.0.1/rpc/models/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { provider: "anthropic" } }),
      }),
      { prefix: "/rpc", context: { actor } },
    );

    expect(response?.status).toBe(200);
    const cleared = {
      where: { userId: actor.userId, modelCredentialId: { in: ["cred-one"] } },
      data: { modelCredentialId: null },
    };
    expect(tx.bot.updateMany).toHaveBeenCalledWith(cleared);
    expect(tx.routine.updateMany).toHaveBeenCalledWith(cleared);
    // Bots and routines are row-secured by Space: the owner's pins in their other
    // Spaces are only reachable with the bypass, still filtered by userId above.
    expect(contexts).toEqual([
      ["bot", "system"],
      ["routine", "system"],
    ]);
  });
});
