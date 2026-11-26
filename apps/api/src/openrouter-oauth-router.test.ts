import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  userId: "user-one",
  spaceId: "space-one",
  email: "one@rakazo.test",
  isDeploymentOwner: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("finishing an OpenRouter sign-in", () => {
  it("exchanges the code with OpenRouter, never through the finance exchange fake", async () => {
    const exchangeFetch = vi.fn(async () => Response.json({ key: "wrong" }));
    const globalFetch = vi.fn(async () => Response.json({ key: "sk-or-test" }));
    vi.stubGlobal("fetch", globalFetch);
    const deps = {
      prisma: {
        modelOAuthState: {
          findFirst: vi.fn(async () => ({
            id: "state-one",
            verifierCiphertext: "sealed",
          })),
          deleteMany: vi.fn(async () => ({ count: 1 })),
        },
      },
      secrets: { load: vi.fn(async () => "verifier") },
      exchangeFetch,
      env: { webOrigin: "http://127.0.0.1:5173", sandboxProvider: "fake" },
    } as unknown as RouterDeps;
    const handler = new RPCHandler(createRouter(deps));

    await handler.handle(
      new Request("http://127.0.0.1/rpc/models/completeOpenRouterOAuth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { state: "state-one", code: "code-one" } }),
      }),
      { prefix: "/rpc", context: { actor } },
    );

    expect(exchangeFetch).not.toHaveBeenCalled();
    expect(globalFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/auth/keys",
      expect.anything(),
    );
  });
});
