import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
} satisfies Actor;

function setup() {
  const preference = { enabled: true, background: false };
  const upsert = vi.fn(async (args: { update: Partial<typeof preference> }) => {
    for (const [key, value] of Object.entries(args.update)) {
      if (value !== undefined) Object.assign(preference, { [key]: value });
    }
  });
  const findMany = vi.fn(async (_args: unknown) => [
    {
      id: "e1",
      kind: "page_source_list",
      reviewReason: "Fits.",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      run: { bot: { name: "Scout" } },
    },
  ]);
  const prisma = {
    actionAutoReviewPreference: { findUnique: vi.fn(async () => preference), upsert },
    userModelCredential: { findFirst: vi.fn(async () => null) },
    externalEffect: { findMany },
  };
  const handler = new RPCHandler(
    createRouter({
      prisma: prisma as unknown as PrismaClient,
      secrets: {},
      env: {
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "http://127.0.0.1:5173",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps),
  );
  async function call(path: "get" | "set" | "recent", input?: unknown) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/autoReview/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input ?? null }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    if (!response) throw new Error("Procedure did not match");
    return { status: response.status, body: (await response.json()) as { json: unknown } };
  }
  return { call, upsert, findMany };
}

describe("autoReview router", () => {
  it("saves the background switch without touching the main one", async () => {
    const { call, upsert } = setup();
    const result = await call("set", { background: true });
    expect(result.status).toBe(200);
    expect(upsert.mock.calls[0]?.[0].update).toEqual({ enabled: undefined, background: true });
    expect(result.body.json).toMatchObject({ enabled: true, background: true });
  });

  it("keeps the default for enabled on a first background-only save", async () => {
    const { call, upsert } = setup();
    await call("set", { background: false });
    expect(upsert.mock.calls[0]?.[0].create).toMatchObject({ enabled: true, background: false });
  });

  it("reports the background switch as off while Auto Review is off", async () => {
    const { call } = setup();
    await call("set", { background: true });
    await call("set", { enabled: false });
    const result = await call("get");
    expect(result.body.json).toMatchObject({ enabled: false, background: false });
  });

  it("lists only this user's and space's passed calls, newest 20", async () => {
    const { call, findMany } = setup();
    const result = await call("recent");
    expect(result.body.json).toEqual([
      {
        id: "e1",
        tool: "page_source_list",
        reason: "Fits.",
        at: "2026-01-02T00:00:00.000Z",
        botName: "Scout",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          spaceId: "space-1",
          reviewDecision: "pass",
          run: { userId: "user-1", spaceId: "space-1" },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: expect.objectContaining({ run: { select: { bot: { select: { name: true } } } } }),
      }),
    );
  });
});
