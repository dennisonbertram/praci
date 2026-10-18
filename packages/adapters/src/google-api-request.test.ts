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
