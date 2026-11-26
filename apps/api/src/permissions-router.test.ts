import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
} satisfies Actor;

function setup() {
  let stored: string | null | undefined; // undefined: no row yet
  const upsert = vi.fn(async (args: { update: { permissionLevel: string | null } }) => {
    stored = args.update.permissionLevel;
  });
  const findUnique = vi.fn(async (_args: unknown) =>
    stored === undefined ? null : { permissionLevel: stored },
  );
  const prisma = { actionAutoReviewPreference: { findUnique, upsert } };
  const handler = new RPCHandler(
    createRouter({
      prisma: prisma as unknown as PrismaClient,
      secrets: {},
      env: { defaultProvider: "fake", defaultModel: "fake-model" },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps),
  );
  async function call(path: "get" | "set", input?: unknown) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/permissions/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input ?? null }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    if (!response) throw new Error("Procedure did not match");
    return { status: response.status, body: (await response.json()) as { json: unknown } };
  }
  return { call, upsert, findUnique };
}

afterEach(() => vi.unstubAllEnvs());

describe("permissions router", () => {
  it("reports no stored level and the deployment default before anything is saved", async () => {
    const { call } = setup();
    const result = await call("get");
    expect(result.body.json).toEqual({ level: null, effectiveDefault: "open" });
  });

  it("saves a level for the caller's own space and user, and reads it back", async () => {
    vi.stubEnv("RAKAZO_PERMISSIONS_DEFAULT", "ask_changes");
    const { call, upsert, findUnique } = setup();
    const saved = await call("set", { level: "ask_everything" });
    expect(saved.body.json).toEqual({ level: "ask_everything", effectiveDefault: "ask_changes" });
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { spaceId_userId: { spaceId: "space-1", userId: "user-1" } },
      update: { permissionLevel: "ask_everything" },
    });
    expect(findUnique.mock.calls[0]?.[0]).toMatchObject({
      where: { spaceId_userId: { spaceId: "space-1", userId: "user-1" } },
    });
  });

  it("clears the level with null", async () => {
    const { call } = setup();
    await call("set", { level: "open" });
    const cleared = await call("set", { level: null });
    expect(cleared.body.json).toMatchObject({ level: null });
  });

  it("rejects an unknown level without writing", async () => {
    const { call, upsert } = setup();
    const result = await call("set", { level: "anything" });
    expect(result.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});
