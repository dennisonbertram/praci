import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConnectorProxyResponse } from "@rakazo/adapter-kit";
import { ComposioEmulator, GmailApiEmulator } from "@rakazo/adapters";
import { describe, expect, it } from "vitest";
import { discardBotIntroRun } from "./discard-bot-intro.js";
import { sessionCookieHeader } from "./index.js";
import { startModelEmulator } from "./model-emulator.js";

type App = { request: (input: string, init?: RequestInit) => Promise<Response> };
const databaseAvailable = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);
const fixtureOrigin = "http://127.0.0.1:5173";

/** Composio stand-in whose proxy answers from the Gmail emulator, so the Composio tools exist. */
class MailComposioEmulator extends ComposioEmulator {
  constructor(private readonly gmail: GmailApiEmulator) {
    super();
  }
  async proxy(request: { accountRef: string; url: string }): Promise<ConnectorProxyResponse> {
    return this.gmail.handle(request.accountRef, request.url);
  }
}

function toolResult(request: { messages: Array<{ role: string; content?: unknown }> }) {
  const last = request.messages.findLast((message) => message.role === "tool");
  return JSON.parse(String(last?.content)) as Record<string, unknown>;
}

describe.skipIf(!databaseAvailable)("finance agent tools in a real run (offline Pi)", () => {
  it("gives the Finance agent finance_* tools and no Composio tools, only once a finance source exists", async () => {
    const gmail = new GmailApiEmulator({
      now: new Date("2026-10-01T12:00:00Z"),
      mailboxes: { "acct-mail": { address: "me@example.test", messages: [] } },
    });
    const fixtureKey = "offline-finance-agent-tools-key";
    const offered: Record<string, string[]> = {};
    const record = (label: string, response: object = { type: "text", text: "Done." }) => ({
      expect(request: { tools?: Array<{ function: { name: string } }> }) {
        offered[label] = (request.tools ?? []).map((tool) => tool.function.name);
      },
      response,
    });
    const model = await startModelEmulator({
      apiKey: fixtureKey,
      steps: [
        record("noSource"),
        record("finance", {
          type: "tool",
          id: "breakdown",
          name: "finance_breakdown",
          arguments: { by: "vendor", range: "365d" },
        }),
        {
          expect(request: { messages: Array<{ role: string; content?: unknown }> }) {
            const result = toolResult(request) as {
              total: number;
              rows: Array<{ name: string; amount: number }>;
            };
            expect(result.rows).toEqual([
              expect.objectContaining({ name: "Vendor A", amount: 12.5 }),
            ]);
            expect(result.total).toBe(12.5);
          },
          response: { type: "text", text: "Done." },
        },
        record("ordinary"),
      ],
    });
    const dataDir = await mkdtemp(path.join(tmpdir(), "rakazo-finance-agent-tools-"));
    let stop: (() => Promise<void>) | undefined;
    try {
      const { createApp } = await import("../../../apps/api/src/app.ts");
      const handles = await createApp({
        databaseUrl: process.env.DATABASE_URL!,
        realtimeDatabaseUrl: process.env.DATABASE_URL!,
        authUrl: fixtureOrigin,
        webOrigin: fixtureOrigin,
        dataDir,
        sandboxProvider: "fake",
        agentRuntime: "pi",
        wakeupDriver: "memory",
        signupsEnabled: "true",
        composio: new MailComposioEmulator(gmail),
        encryptionKey: "offline-finance-fixture-encryption-key",
      });
      stop = handles.stop;
      const signup = await handles.app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: fixtureOrigin },
        body: JSON.stringify({
          email: `finance-agent-tools-${randomUUID()}@rakazo.test`,
          password: "password12",
          name: "Finance agent tools fixture",
        }),
      });
      expect(signup.status).toBeLessThan(400);
      const cookie = sessionCookieHeader(signup);
      await rpc(handles.app, cookie, "models/connect", {
        provider: model.model.provider,
        modelId: model.model.id,
        baseUrl: model.baseUrl,
        apiKey: fixtureKey,
        contextWindow: 160_000,
        maxTokens: 4096,
      });
      const finance = await rpc<{ id: string }>(handles.app, cookie, "finance/agent");
      const ordinary = await rpc<{ id: string }>(handles.app, cookie, "bots/create", {
        name: "Ordinary",
        title: "",
        description: "",
        instructions: "Help.",
        notifyOnFinish: false,
      });
      await discardBotIntroRun(handles, cookie, ordinary.id);
      for (const botId of [finance.id, ordinary.id]) {
        await rpc(handles.app, cookie, "bots/update", {
          botId,
          modelProvider: model.model.provider,
          modelId: model.model.id,
        });
      }
      const bot = await handles.prisma.bot.findUniqueOrThrow({ where: { id: finance.id } });
      const owner = { spaceId: bot.spaceId, userId: bot.userId };
      await handles.prisma.connection.create({
        data: {
          ...owner,
          connectorId: "composio",
          provider: "gmail",
          providerRef: "acct-mail",
          displayName: "Gmail",
          status: "connected",
          metadata: { mailAddress: "me@example.test" },
        },
      });
      const send = async (botId: string) => {
        const sent = await rpc<{ runId: string }>(handles.app, cookie, "threads/send", {
          botId,
          text: "Where does my spend go?",
        });
        await expect
          .poll(
            async () =>
              (await handles.prisma.run.findUniqueOrThrow({ where: { id: sent.runId } })).status,
            { timeout: 15_000, interval: 100 },
          )
          .toBe("completed");
      };

      await send(finance.id);
      // The source is added after the agent exists, so no vendor MCP server is assigned or contacted.
      const server = await handles.prisma.mcpServer.create({
        data: {
          ...owner,
          slug: "mercury",
          name: "Mercury",
          transport: "streamable_http",
          endpoint: "https://mcp.mercury.com/mcp",
        },
      });
      await handles.prisma.financeTransaction.create({
        data: {
          ...owner,
          mcpServerId: server.id,
          provider: "mercury",
          externalId: "t1",
          accountExternalId: "chk",
          postedAt: new Date(Date.now() - 5 * 86_400_000),
          amountCents: -1250n,
          currency: "USD",
          counterparty: "Vendor A",
          vendorKey: "vendor-a",
          category: "Software",
          status: "posted",
          kind: "externalTransfer",
          classification: "spend",
        },
      });
      await send(finance.id);
      await send(ordinary.id);
      model.assertComplete();

      const financeTools = (names: string[]) => names.filter((name) => name.startsWith("finance_"));
      const gmailTools = (names: string[]) => names.filter((name) => /gmail/i.test(name));
      expect(financeTools(offered.noSource ?? [])).toEqual([]);
      expect(financeTools(offered.finance ?? []).sort()).toEqual([
        "finance_breakdown",
        "finance_crypto",
        "finance_overview",
        "finance_recurring",
        "finance_transactions",
      ]);
      expect(gmailTools(offered.finance ?? [])).toEqual([]);
      expect(gmailTools(offered.ordinary ?? [])).not.toEqual([]);
      const messages = await handles.prisma.message.findMany({
        where: { thread: { botId: finance.id } },
      });
      expect(JSON.stringify(messages.map((m) => m.blocks))).toContain('"kind":"finance"');
    } finally {
      try {
        await stop?.();
      } finally {
        await model.close();
        await rm(dataDir, { recursive: true, force: true });
      }
    }
  }, 60_000);
});

async function rpc<T>(
  app: App,
  cookie: string,
  procedure: string,
  input: unknown = {},
): Promise<T> {
  const response = await app.request(`/rpc/${procedure}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: fixtureOrigin },
    body: JSON.stringify({ json: input }),
  });
  const body = (await response.json()) as { json?: T; error?: { message?: string } };
  if (response.status >= 400 || body.error)
    throw new Error(`${procedure}: ${body.error?.message ?? response.status}`);
  return body.json as T;
}
