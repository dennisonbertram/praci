import type { AdapterContext } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { createMailUnsubscriber } from "./mail-unsubscribe.js";

const context: AdapterContext = {
  operationId: "unsub",
  traceId: "unsub",
  spaceId: "s",
  userId: "u",
  signal: new AbortController().signal,
};
const resolveHostname = async () => [{ address: "203.0.113.10", family: 4 as const }];
const make = (respond: () => Response) => {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    urls.push(String(input));
    return respond();
  };
  return { urls, unsubscriber: createMailUnsubscriber({ fetch, resolveHostname }) };
};

describe("createMailUnsubscriber", () => {
  it("posts once to the https url", async () => {
    const { urls, unsubscriber } = make(() => new Response("ok"));
    await unsubscriber.oneClick("https://lists.example.test/u/1", context);
    expect(urls).toEqual(["https://lists.example.test/u/1"]);
  });

  it("rejects a url that is not https as invalid, without a request", async () => {
    const { urls, unsubscriber } = make(() => new Response("ok"));
    for (const url of ["http://lists.example.test/u", "not a url", "mailto:u@example.test"])
      await expect(unsubscriber.oneClick(url, context)).rejects.toMatchObject({
        kind: "invalid",
      });
    expect(urls).toEqual([]);
  });

  it("maps a 500 and a redirect to unavailable", async () => {
    for (const response of [
      () => new Response("no", { status: 500 }),
      () => new Response(null, { status: 302, headers: { location: "https://x.example.test/" } }),
    ]) {
      const { unsubscriber } = make(response);
      const error = await unsubscriber
        .oneClick("https://lists.example.test/u/1", context)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(MailProviderError);
      expect(error).toMatchObject({ kind: "unavailable" });
    }
  });
});
