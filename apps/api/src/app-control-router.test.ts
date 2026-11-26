import { RPCHandler } from "@orpc/server/fetch";
import type { AppControlProvider } from "@rakazo/adapter-kit";
import { FakeAppControl, InMemoryAppControlStore } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

// Offline boundary: a fake Prisma client drives the real handlers; FakeAppControl is the provider.

const owner: Actor = {
  spaceId: "s1",
  userId: "u1",
  email: "o@rakazo.test",
  isDeploymentOwner: true,
};
const member: Actor = { ...owner, isDeploymentOwner: false };
const music = { id: "com.apple.Music", name: "Music" };
const notes = { id: "com.apple.Notes", name: "Notes" };
const terminal = { id: "com.apple.Terminal", name: "Terminal" };

function setup(opts: {
  provider?: AppControlProvider | null;
  runsOn?: string | null;
  host?: string;
}) {
  const update = vi.fn(async () => ({ id: "b1", name: "n", title: "", description: "" }));
  const prisma = {
    bot: {
      findFirst: vi.fn(async () => ({
        id: "b1",
        userId: "u1",
        spaceId: "s1",
        archivedAt: null,
        runsOn: opts.runsOn ?? null,
        appControlEnabled: opts.enabled ?? false,
        thread: { id: "t1" },
        computer: null,
      })),
      update,
      findMany: vi.fn(async () => {
        throw new Error("after update");
      }),
    },
    deploymentSettings: {
      findUnique: vi.fn(async () => ({ computerHost: opts.host ?? "docker" })),
    },
  };
  const provider =
    opts.provider === null
      ? undefined
      : (opts.provider ?? new FakeAppControl({ store: new InMemoryAppControlStore() }));
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    env: { sandboxProvider: "docker" },
    events: { notify: vi.fn() },
    ...(provider ? { appControl: provider } : {}),
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function call(actor: Actor, path: string, input?: unknown) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input ?? {} }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    if (!response) throw new Error("no match");
    return { status: response.status, body: (await response.json()) as { json: any } };
  }
  const updateBot = (actor: Actor, appControl: unknown) =>
    call(actor, "bots/update", { botId: "b1", appControl });
  return { call, updateBot, update };
}

describe("appControl.status and appControl.apps", () => {
  it("reports availability to the owner only", async () => {
    const { call } = setup({});
    expect((await call(owner, "appControl/status")).body.json).toMatchObject({
      available: true,
      accessibility: "granted",
    });
    expect((await call(member, "appControl/status")).body.json).toEqual({
      available: false,
      accessibility: "unknown",
      platform: null,
    });
  });

  it("tells only the owner when agent-desktop is not installed", async () => {
    const missing = {
      status: async () => ({ available: false, accessibility: "unknown", installed: false }),
    } as unknown as AppControlProvider;
    const { call } = setup({ provider: missing });
    expect((await call(owner, "appControl/status")).body.json).toMatchObject({
      available: false,
      needsInstall: true,
    });
    expect((await call(member, "appControl/status")).body.json).not.toHaveProperty("needsInstall");
    const unreachable = {
      status: async () => ({ available: false, accessibility: "unknown" }),
    } as unknown as AppControlProvider;
    expect(
      (await setup({ provider: unreachable }).call(owner, "appControl/status")).body.json,
    ).not.toHaveProperty("needsInstall");
  });

  it("is unavailable without a provider or when the provider fails", async () => {
    expect(
      (await setup({ provider: null }).call(owner, "appControl/status")).body.json.available,
    ).toBe(false);
    const broken = {
      status: async () => Promise.reject(new Error("x")),
    } as unknown as AppControlProvider;
    expect(
      (await setup({ provider: broken }).call(owner, "appControl/status")).body.json.available,
    ).toBe(false);
  });

  it("lists running apps for the owner without denied ones, and refuses others", async () => {
    const listApps = async () => [music, terminal];
    const provider = { listApps } as unknown as AppControlProvider;
    const { call } = setup({ provider });
    expect((await call(owner, "appControl/apps")).body.json).toEqual({ apps: [music] });
    expect((await call(member, "appControl/apps")).status).toBe(403);
    expect((await setup({ provider: null }).call(owner, "appControl/apps")).status).toBe(412);
  });
});

describe("bots.update appControl", () => {
  it("refuses a non-owner", async () => {
    const { updateBot, update } = setup({});
    expect((await updateBot(member, { enabled: true })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses turning it on without a provider", async () => {
    const { updateBot, update } = setup({ provider: null });
    expect((await updateBot(owner, { enabled: true })).status).toBe(412);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses turning it on for a bot that runs on this Mac, by bot or by default", async () => {
    for (const s of [setup({ runsOn: "this-mac" }), setup({ host: "this-mac" })]) {
      expect((await s.updateBot(owner, { enabled: true })).status).toBe(400);
      expect(s.update).not.toHaveBeenCalled();
    }
  });

  it("refuses denied apps and more than 20 apps", async () => {
    const { updateBot, update } = setup({});
    expect((await updateBot(owner, { apps: [music, terminal] })).status).toBe(400);
    const many = Array.from({ length: 21 }, (_, i) => ({ id: `app.${i}`, name: `App ${i}` }));
    expect((await updateBot(owner, { apps: many })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("stores a valid update with duplicate apps removed", async () => {
    const { updateBot, update } = setup({});
    await updateBot(owner, {
      enabled: true,
      apps: [music, { id: "COM.APPLE.MUSIC", name: "Music" }, notes],
      headed: true,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appControlEnabled: true,
          appControlApps: [music, notes],
          appControlHeaded: true,
        }),
      }),
    );
  });

  it("lets the owner turn it off and clear apps with no provider on a this-mac bot", async () => {
    const { updateBot, update } = setup({ provider: null, runsOn: "this-mac" });
    await updateBot(owner, { enabled: false, apps: [] });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ appControlEnabled: false, appControlApps: [] }),
      }),
    );
  });

  it("refuses enabling and moving to this Mac in one update", async () => {
    const { call, update } = setup({});
    const result = await call(owner, "bots/update", {
      botId: "b1",
      runsOn: "this-mac",
      appControl: { enabled: true },
    });
    expect(result.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses moving a bot with app control on to this Mac unless the update turns it off", async () => {
    const refused = setup({ enabled: true });
    expect(
      (await refused.call(owner, "bots/update", { botId: "b1", runsOn: "this-mac" })).status,
    ).toBe(400);
    expect(refused.update).not.toHaveBeenCalled();
    const allowed = setup({ enabled: true });
    await allowed.call(owner, "bots/update", {
      botId: "b1",
      runsOn: "this-mac",
      appControl: { enabled: false },
    });
    expect(allowed.update).toHaveBeenCalled();
  });
});
