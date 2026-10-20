import type {
  AdapterContext,
  ConnectorProxyRequest,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { GmailMailProvider } from "./gmail-mail-provider.js";

const TOPIC = "projects/example-project/topics/example-mail";
const context: AdapterContext = {
  operationId: "op",
  traceId: "op",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};
const account = (connectorId: string): MailAccount => ({
  id: "conn-1",
  connectorId,
  app: "gmail",
  accountRef: "acct",
  label: "Test",
  spaceId: "space-1",
  userId: "user-1",
  address: "me@example.test",
});

function setup() {
  const gmail = new GmailApiEmulator({
    mailboxes: { acct: { address: "me@example.test", messages: [] } },
  });
  const connector = {
    proxy: async (request: ConnectorProxyRequest) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
  } as unknown as ManagedConnectorProvider;
  const provider = new GmailMailProvider({ connectors: { managed: () => connector } });
  return { gmail, provider };
}
const posts = (gmail: GmailApiEmulator) => gmail.requests.filter((r) => r.method === "POST");

describe("Gmail push watch", () => {
  it("watches INBOX and SENT through the native Google route and returns the expiry", async () => {
    const { gmail, provider } = setup();
    const watch = await provider.watchChanges(account("google"), { topic: TOPIC }, context);
    expect(watch?.cursor).toMatch(/^\d+$/);
    expect(Date.parse(watch?.expiresAt ?? "")).toBeGreaterThan(Date.now());
    expect(gmail.watchOf("acct")).toMatchObject({ topicName: TOPIC, labelIds: ["INBOX", "SENT"] });
    expect(posts(gmail).map((r) => r.url)).toEqual([
      "https://gmail.googleapis.com/gmail/v1/users/me/watch",
    ]);
  });

  it("renews with the same call: one watch per mailbox, expiry moves", async () => {
    let now = new Date("2026-11-01T00:00:00Z");
    const gmail = new GmailApiEmulator({
      clock: () => now,
      mailboxes: { acct: { address: "me@example.test", messages: [] } },
    });
    const connector = {
      proxy: async (r: ConnectorProxyRequest) =>
        gmail.handle(r.accountRef, r.url, r.method, r.body),
    } as unknown as ManagedConnectorProvider;
    const provider = new GmailMailProvider({ connectors: { managed: () => connector } });
    const first = await provider.watchChanges(account("google"), { topic: TOPIC }, context);
    now = new Date("2026-11-03T00:00:00Z");
    const second = await provider.watchChanges(account("google"), { topic: TOPIC }, context);
    expect(Date.parse(second?.expiresAt ?? "")).toBe(
      Date.parse(first?.expiresAt ?? "") + 2 * 86_400_000,
    );
    expect(gmail.watchOf("acct")?.expiration).toBe(Date.parse(second?.expiresAt ?? ""));
  });

  it.each(["composio", "pipedream", "emulator"])(
    "returns null for the %s route without a Gmail request",
    async (connectorId) => {
      const { gmail, provider } = setup();
      expect(
        await provider.watchChanges(account(connectorId), { topic: TOPIC }, context),
      ).toBeNull();
      await provider.stopWatch(account(connectorId), context);
      expect(gmail.requests).toEqual([]);
    },
  );

  it("stops the watch, and stopping again succeeds", async () => {
    const { gmail, provider } = setup();
    await provider.watchChanges(account("google"), { topic: TOPIC }, context);
    await provider.stopWatch(account("google"), context);
    expect(gmail.watchOf("acct")).toBeUndefined();
    await expect(provider.stopWatch(account("google"), context)).resolves.toBeUndefined();
  });

  it("maps a refused topic to invalid", async () => {
    const { provider } = setup();
    await expect(
      provider.watchChanges(account("google"), { topic: "not-a-topic" }, context),
    ).rejects.toMatchObject({ kind: "invalid" });
  });

  it("maps a lost login to auth and refuses another user's account", async () => {
    const { gmail, provider } = setup();
    gmail.failNext(401);
    await expect(
      provider.watchChanges(account("google"), { topic: TOPIC }, context),
    ).rejects.toMatchObject({ kind: "auth" });
    await expect(
      provider.watchChanges(account("google"), { topic: TOPIC }, { ...context, userId: "other" }),
    ).rejects.toBeInstanceOf(MailProviderError);
  });
});
