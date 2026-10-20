import { RPCHandler } from "@orpc/server/fetch";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

function harness() {
  const messagingSettings = {
    state: vi.fn(async () => [
      { id: "photon", fields: {}, configured: false, active: false, webhookUrl: null },
    ]),
    save: vi.fn(async () => undefined),
    test: vi.fn(async () => ({ ok: true as const })),
  };
  const handler = new RPCHandler(
    createRouter({ prisma: {}, env: {}, messagingSettings } as unknown as RouterDeps),
  );
  const call = async (path: string, owner: boolean, json: unknown = null) => {
    const { response } = await handler.handle(
      new Request(`https://example.test/rpc/messagingSetup/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json }),
      }),
      {
        prefix: "/rpc",
        context: {
          actor: { userId: "u", spaceId: "s", email: "u@rakazo.test", isDeploymentOwner: owner },
        },
      },
    );
    return {
      status: response!.status,
      body: response!.status === 200 ? (await response!.json()).json : null,
    };
  };
  return { messagingSettings, call };
}

describe("messagingSetup authorization", () => {
  it("shows a member nothing and refuses their save and test", async () => {
    const { messagingSettings, call } = harness();
    expect((await call("get", false)).body).toEqual({ canConfigure: false, providers: [] });
    const save = await call("save", false, {
      provider: "photon",
      projectId: "p",
      projectSecret: "s",
      webhookSecret: "w",
    });
    expect(save.status).toBe(403);
    expect((await call("test", false, { provider: "photon" })).status).toBe(403);
    expect(messagingSettings.state).not.toHaveBeenCalled();
    expect(messagingSettings.save).not.toHaveBeenCalled();
    expect(messagingSettings.test).not.toHaveBeenCalled();
  });

  it("lets the deployment owner read, save and test", async () => {
    const { messagingSettings, call } = harness();
    expect((await call("get", true)).body.canConfigure).toBe(true);
    expect(
      (
        await call("save", true, {
          provider: "photon",
          projectId: "p",
          projectSecret: "s",
          webhookSecret: "w",
        })
      ).status,
    ).toBe(200);
    expect((await call("test", true, { provider: "photon" })).body).toEqual({ ok: true });
    expect(messagingSettings.save).toHaveBeenCalledOnce();
  });
});
