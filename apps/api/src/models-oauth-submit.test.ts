import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  userId: "user-one",
  spaceId: "space-one",
  email: "one@rakazo.test",
  isDeploymentOwner: true,
};

async function submit(error: Error) {
  const deps = {
    prisma: {},
    oauthLogins: {
      submit: vi.fn(() => {
        throw error;
      }),
    },
    env: { webOrigin: "http://127.0.0.1:5173", sandboxProvider: "fake" },
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  const { response } = await handler.handle(
    new Request("http://127.0.0.1/rpc/models/submitOAuthCode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { loginId: "login-one", code: "pasted-secret-code" } }),
    }),
    { prefix: "/rpc", context: { actor } },
  );
  return { status: response?.status, body: await response?.text() };
}

describe("pasting a subscription sign-in code", () => {
  it("shows why the sign-in cannot take the code instead of a masked 500", async () => {
    const result = await submit(new Error("Sign-in session not found. Start sign-in again."));
    expect(result.status).toBe(400);
    expect(result.body).toContain("Sign-in session not found. Start sign-in again.");
  });

  it("never echoes the pasted code", async () => {
    const result = await submit(new Error("Rejected pasted-secret-code by the provider"));
    expect(result.status).toBe(400);
    expect(result.body).not.toContain("pasted-secret-code");
  });
});
