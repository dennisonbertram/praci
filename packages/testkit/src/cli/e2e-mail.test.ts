import type { AdapterContext } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { createE2eComposio } from "./e2e-mail.js";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const context = (userId: string) => ({ userId, spaceId: "s1" }) as AdapterContext;
const raw = (to: string) =>
  Buffer.from(`To: ${to}\r\nSubject: Hello\r\nContent-Type: text/plain\r\n\r\nHi there`).toString(
    "base64url",
  );

async function setup(options: Parameters<typeof createE2eComposio>[1]) {
  const composio = createE2eComposio(undefined, options);
  const redirectUrl = "http://localhost/cb";
  const first = (await composio.begin({ provider: "GMAIL", redirectUrl }, context("u1"))).state;
  const second = (await composio.begin({ provider: "GMAIL", redirectUrl }, context("u1"))).state;
  const send = async (accountRef: string, to: string) => {
    const draft = await composio.proxy({
      accountRef,
      url: `${BASE}/drafts`,
      method: "POST",
      body: { message: { raw: raw(to) } },
    } as never);
    const id = (draft.data as { id: string }).id;
    return composio.proxy({
      accountRef,
      url: `${BASE}/drafts/send`,
      method: "POST",
      body: { id },
    } as never);
  };
  const inbox = async (accountRef: string) => {
    const listed = await composio.proxy({
      accountRef,
      url: `${BASE}/messages?q=Hello`,
      method: "GET",
    } as never);
    return (listed.data as { messages?: unknown[] }).messages ?? [];
  };
  return { composio, first, second, send, inbox };
}

describe("demo Composio", () => {
  it("delivers mail sent to the user's other account into that Inbox", async () => {
    const t = await setup({ deliverBetweenOwnAccounts: true });
    expect(await inbox(t, t.second)).toHaveLength(0);
    expect((await t.send(t.first, "second@example.test")).status).toBe(200);
    expect(await inbox(t, t.second)).toHaveLength(1);
  });

  it("delivers mail the user sends to their own address", async () => {
    const t = await setup({ deliverBetweenOwnAccounts: true });
    await t.send(t.first, "first@example.test");
    // The Sent copy and the one that arrived.
    expect(await inbox(t, t.first)).toHaveLength(2);
  });

  it("keeps mail to the other account out of its Inbox when delivery is off", async () => {
    const t = await setup({});
    await t.send(t.first, "second@example.test");
    expect(await inbox(t, t.second)).toHaveLength(0);
  });

  it("fails a send to the bounce domain and sends nothing", async () => {
    const t = await setup({ bounceDomain: "send-fail.example.test" });
    const response = await t.send(t.first, "bounce@send-fail.example.test");
    expect(response.status).toBe(400);
    expect(t.composio.gmailFor("u1")["e2e-first"]?.sent).toHaveLength(0);
  });
});

const inbox = (t: Awaited<ReturnType<typeof setup>>, ref: string) => t.inbox(ref);
