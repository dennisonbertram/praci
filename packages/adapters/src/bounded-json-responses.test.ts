import { describe, expect, it } from "vitest";
import { InfisicalSecretStore, SecretStoreUnavailableError } from "./infisical-secret-store.js";
import { StripeBillingProvider } from "./stripe-billing.js";

/** A JSON body that never ends; an unbounded `response.json()` would read it forever. */
function endlessResponse(): Response {
  const chunk = new TextEncoder().encode(`{"x":"${"a".repeat(1_000_000)}`);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

describe("bounded JSON responses", () => {
  it("stops reading an endless Stripe body", async () => {
    const provider = new StripeBillingProvider({
      secretKey: "sk_test_fake",
      webhookSecret: "whsec_fake",
      priceId: "price_fake",
      fetch: async () => endlessResponse(),
    });
    await expect(provider.getPrice()).rejects.toThrow();
  }, 5_000);

  it("stops reading an endless Infisical body", async () => {
    const store = new InfisicalSecretStore({
      baseUrl: "https://infisical.example",
      clientId: "id",
      clientSecret: "secret",
      projectId: "p",
      environment: "dev",
      folder: "/",
      fetch: async () => endlessResponse(),
    });
    const context = {
      operationId: "t",
      traceId: "t",
      spaceId: "s",
      userId: "u",
      signal: new AbortController().signal,
    };
    await expect(store.put("value", context)).rejects.toBeInstanceOf(SecretStoreUnavailableError);
  }, 5_000);
});
