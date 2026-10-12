import type {
  AdapterContext,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { GmailMailProvider } from "./gmail-mail-provider.js";
import { IntegrationProviderSettings } from "./integration-provider-settings.js";
import { EncryptedSecretStore } from "./secrets.js";

const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};
const account: MailAccount = {
  id: "conn-1",
  connectorId: "test",
  app: "gmail",
  accountRef: "x",
  label: "Test",
  spaceId: "space-1",
  userId: "user-1",
  address: null,
};

describe("mail provider regressions", () => {
  it("accounts for every listed id exactly once when some are deleted and some are rate limited", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `id${i}`);
    const proxy = async ({ url }: ConnectorProxyRequest): Promise<ConnectorProxyResponse> => {
      const u = new URL(url);
      if (u.pathname.endsWith("/messages")) {
        return { status: 200, data: { messages: ids.map((id) => ({ id, threadId: "t" })) } };
      }
      const id = u.pathname.split("/").pop() as string;
      if (id === "id2") return { status: 404, data: {} };
      if (id === "id5") return { status: 429, data: {}, retryAfterMs: 1 };
      return {
        status: 200,
        data: { id, threadId: "t", internalDate: "1700000000000", payload: { headers: [] } },
      };
    };
    const provider = new GmailMailProvider({
      connectors: { managed: () => ({ proxy }) as unknown as ManagedConnectorProvider },
      sleep: async () => {},
    });
    const page = await provider.listMessages(account, { query: "", pageSize: 12 }, context);
    const hydrated = page.messages.map((m) => m.id);
    const unhydrated = page.unhydratedIds ?? [];

    expect(unhydrated).toContain("id5");
    expect(unhydrated).not.toContain("id2");
    expect(hydrated).not.toContain("id2");
    expect(hydrated).toEqual(ids.filter((id) => hydrated.includes(id)));
    expect(unhydrated).toEqual(ids.filter((id) => unhydrated.includes(id)));
    expect([...hydrated, ...unhydrated].sort()).toEqual(ids.filter((id) => id !== "id2").sort());
  });

  it("does not let one account's rate limit block another account's reads", async () => {
    const emulator = createMailEmulator({ sleep: async () => {}, random: () => 0 });
    const [a, b] = emulator.accounts as [MailAccount, MailAccount];
    const ctx = { ...context, spaceId: a.spaceId, userId: a.userId };
    emulator.gmail.failNext(429, { times: 100 });
    const limited = await emulator.provider.listMessages(a, { query: "", pageSize: 5 }, ctx).then(
      () => "ok",
      (error: { kind?: string }) => error.kind,
    );
    expect(limited).toBe("rate_limited");
    emulator.gmail.clearFailures();
    const other = await emulator.provider.listMessages(b, { query: "", pageSize: 5 }, ctx);
    expect(other.messages).toHaveLength(5);
    expect(other.unhydratedIds ?? []).toEqual([]);
  });

  it("refuses to proxy through an unconfigured integration provider", async () => {
    const prisma = {
      integrationProviderConfig: { findUnique: async () => null },
    } as unknown as PrismaClient;
    const settings = new IntegrationProviderSettings(
      prisma,
      new EncryptedSecretStore("test-encryption-key"),
      "test-identity",
    );
    const wrapper = settings.providers().find((p) => p.describe().id === "composio");
    await expect(
      wrapper?.proxy?.(
        { app: "gmail", accountRef: "x", method: "GET", url: "https://gmail.googleapis.com/" },
        context,
      ),
    ).rejects.toThrow(/Set up an integration provider/);
  });
});
