import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { expect, it } from "vitest";
import { GoogleApiClient } from "./google-api-request.js";

it("spaces request starts per account, and paces accounts independently", async () => {
  // The clock stays at 0, so each pause is the wait from "now" to that request's reserved start.
  const pauses: number[] = [];
  const connector = {
    proxy: async () => {
      return { status: 200, data: {} };
    },
  } as unknown as ManagedConnectorProvider;
  const client = new GoogleApiClient({
    startGapMs: 250,
    now: () => 0,
    pause: async (ms) => void pauses.push(ms),
  });
  const context = { signal: new AbortController().signal } as AdapterContext;
  const get = (providerRef: string) =>
    client.request({
      connector,
      account: { connectorId: "c", providerRef, app: "gmail" },
      method: "GET",
      url: "https://example.test/x",
      context,
    });

  await Promise.all([get("A"), get("A"), get("A")]);
  expect(pauses).toEqual([250, 500]);
  await Promise.all([get("B"), get("B")]);
  expect(pauses).toEqual([250, 500, 250]);
});

it("asks the write check before every attempt, so a retry after a rate limit can be refused", async () => {
  let proxied = 0;
  const connector = {
    proxy: async () => {
      proxied++;
      return { status: 429, data: {} };
    },
  } as unknown as ManagedConnectorProvider;
  const client = new GoogleApiClient({ sleep: async () => undefined, random: () => 0 });
  const refusal = new Error("no longer allowed");
  const context = {
    signal: new AbortController().signal,
    // Allowed for the first attempt only.
    beforeWrite: async () => {
      if (proxied >= 1) throw refusal;
    },
  } as AdapterContext;
  const call = (method: "GET" | "POST") =>
    client.request({
      connector,
      account: { connectorId: "c", providerRef: "A", app: "gmail" },
      method,
      url: "https://example.test/x",
      context,
    });
  await expect(call("POST")).rejects.toBe(refusal);
  expect(proxied).toBe(1);
  // A read is not a write: it keeps retrying without the check.
  proxied = 0;
  await expect(call("GET")).rejects.toMatchObject({ kind: "response" });
  expect(proxied).toBe(3);
});

it("treats a wrapped cancellation as an abort, and a wrapped network error as transport", async () => {
  const failing = (error: unknown) => {
    const controller = new AbortController();
    return new GoogleApiClient({ sleep: async () => undefined, random: () => 0 }).request({
      connector: {
        proxy: async () => {
          controller.abort();
          throw error;
        },
      } as unknown as ManagedConnectorProvider,
      account: { connectorId: "c", providerRef: "A", app: "gmail" },
      method: "GET",
      url: "https://example.test/x",
      context: { signal: controller.signal } as AdapterContext,
    });
  };
  const aborted = new DOMException("stopped", "AbortError");
  await expect(failing(new Error("wrapped", { cause: aborted }))).rejects.toMatchObject({
    kind: "aborted",
  });
  await expect(failing(new Error("wrapped", { cause: new TypeError("x") }))).rejects.toMatchObject({
    kind: "transport",
  });
});
