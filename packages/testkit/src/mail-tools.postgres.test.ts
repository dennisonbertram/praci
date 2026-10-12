import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConnectorProxyResponse } from "@rakazo/adapter-kit";
import { ComposioEmulator, FakeSandboxProvider, GmailApiEmulator } from "@rakazo/adapters";
import { describe, expect, it } from "vitest";
import { discardBotIntroRun } from "./discard-bot-intro.js";
import { sessionCookieHeader } from "./index.js";
import { startModelEmulator } from "./model-emulator.js";

type App = { request: (input: string, init?: RequestInit) => Promise<Response> };
const databaseAvailable = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);
const fixtureOrigin = "http://127.0.0.1:5173";

/** Composio stand-in whose proxy answers from the Gmail emulator, so the real mail provider runs. */
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

describe.skipIf(!databaseAvailable)(
  "mail tools in a real run (offline Pi + Gmail emulator)",
  () => {
    it("runs mail_search then mail_grep for the bot owner, then clears the search when mail is disconnected", async () => {
      const gmail = new GmailApiEmulator({
        now: new Date("2026-10-01T12:00:00Z"),
        mailboxes: {
          "acct-mail": {
            address: "me@example.test",
            messages: [
              {
                id: "first-hello",
                date: "2024-02-03T08:00:00Z",
                labels: ["INBOX"],
                from: "Jana <jana@example.test>",
                to: "Me <me@example.test>",
                subject: "First hello from Jana",
              },
              {
                id: "later-note",
                date: "2025-05-06T09:00:00Z",
                labels: ["INBOX"],
                from: "Jana <jana@example.test>",
                to: "Me <me@example.test>",
                subject: "A later note",
              },
            ],
          },
        },
      });
      const fixtureKey = "offline-mail-tools-key";
      const model = await startModelEmulator({
        apiKey: fixtureKey,
        steps: [
          {
            expect(request) {
              const names = (request.tools ?? []).map(
                (tool: { function: { name: string } }) => tool.function.name,
              );
              expect(names).toEqual(
                expect.arrayContaining(["mail_search", "mail_grep", "mail_get"]),
              );
            },
            response: {
              type: "tool",
              id: "search",
              name: "mail_search",
              arguments: { queries: ["from:jana"] },
            },
          },
          {
            expect(request) {
              expect(toolResult(request)).toMatchObject({ records: 2, coverage: "complete" });
            },
            response: (request) => ({
              type: "tool",
              id: "grep",
              name: "mail_grep",
              arguments: { searchId: toolResult(request).searchId, patterns: ["first hello"] },
            }),
          },
          {
            expect(request) {
              const result = toolResult(request) as {
                totalMatches: number;
                matches: { text: string }[];
              };
              expect(result.totalMatches).toBe(1);
              expect(result.matches[0]?.text).toContain("id:first-hello");
            },
            response: { type: "text", text: "Jana first wrote on 3 February 2024." },
          },
        ],
      });
      const dataDir = await mkdtemp(path.join(tmpdir(), "rakazo-mail-tools-"));
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
          encryptionKey: "offline-mail-fixture-encryption-key",
        });
        stop = handles.stop;
        expect(handles.sandbox).toBeInstanceOf(FakeSandboxProvider);
        const signup = await handles.app.request("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: fixtureOrigin },
          body: JSON.stringify({
            email: `mail-tools-${randomUUID()}@rakazo.test`,
            password: "password12",
            name: "Mail tools fixture",
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
        const bot = await rpc<{ id: string }>(handles.app, cookie, "bots/create", {
          name: "Mail fixture",
          title: "",
          description: "",
          instructions: "Answer questions about the user's mail.",
          notifyOnFinish: false,
        });
        await discardBotIntroRun(handles, cookie, bot.id);
        await rpc(handles.app, cookie, "bots/update", {
          botId: bot.id,
          modelProvider: model.model.provider,
          modelId: model.model.id,
        });
        const storedBot = await handles.prisma.bot.findUniqueOrThrow({ where: { id: bot.id } });
        const connection = await handles.prisma.connection.create({
          data: {
            spaceId: storedBot.spaceId,
            userId: storedBot.userId,
            connectorId: "composio",
            provider: "gmail",
            providerRef: "acct-mail",
            displayName: "Gmail",
            status: "connected",
            metadata: { mailAddress: "me@example.test" },
          },
        });
        const sent = await rpc<{ runId: string }>(handles.app, cookie, "threads/send", {
          botId: bot.id,
          text: "When did Jana first email me?",
        });
        await expect
          .poll(
            async () => {
              const run = await handles.prisma.run.findUniqueOrThrow({ where: { id: sent.runId } });
              if (run.status === "failed") model.assertComplete();
              return run.status;
            },
            { timeout: 15_000, interval: 100 },
          )
          .toBe("completed");
        model.assertComplete();
        // The search belongs to the run's space, user and bot, and no approval card was raised.
        const searches = await handles.prisma.mailSearch.findMany({
          where: { spaceId: storedBot.spaceId },
        });
        expect(searches).toHaveLength(1);
        expect(searches[0]).toMatchObject({ userId: storedBot.userId, botId: bot.id });
        expect(await handles.prisma.externalEffect.count({ where: { runId: sent.runId } })).toBe(0);

        // Revoking the Gmail connection keeps its row, so the revoke handler must clear the saved search.
        await rpc(handles.app, cookie, "connections/revoke", { connectionId: connection.id });
        expect(
          await handles.prisma.connection.findUniqueOrThrow({ where: { id: connection.id } }),
        ).toMatchObject({ status: "revoked" });
        expect(
          await handles.prisma.mailSearch.count({ where: { spaceId: storedBot.spaceId } }),
        ).toBe(0);
        expect(
          await handles.prisma.mailSearchRow.count({ where: { searchId: searches[0]?.id } }),
        ).toBe(0);
      } finally {
        try {
          await stop?.();
        } finally {
          await model.close();
          await rm(dataDir, { recursive: true, force: true });
        }
      }
    }, 45_000);

    it("gives the Inbox agent only the mail tools, while an ordinary bot with the same Gmail connection also gets the Composio tools", async () => {
      const gmail = new GmailApiEmulator({
        now: new Date("2026-10-01T12:00:00Z"),
        mailboxes: { "acct-mail": { address: "me@example.test", messages: [] } },
      });
      const fixtureKey = "offline-inbox-agent-tools-key";
      const offered: Record<string, string[]> = {};
      const systemText: Record<string, string> = {};
      const record = (label: string) => ({
        expect(request: {
          tools?: Array<{ function: { name: string } }>;
          messages: Array<{ role: string; content?: unknown }>;
        }) {
          offered[label] = (request.tools ?? []).map((tool) => tool.function.name);
          systemText[label] = request.messages
            .filter((message) => message.role === "system")
            .map((message) => JSON.stringify(message.content))
            .join("\n");
        },
        response: { type: "text" as const, text: "Done." },
      });
      const model = await startModelEmulator({
        apiKey: fixtureKey,
        steps: [record("ordinary"), record("inbox")],
      });
      const dataDir = await mkdtemp(path.join(tmpdir(), "rakazo-inbox-agent-tools-"));
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
          encryptionKey: "offline-mail-fixture-encryption-key",
        });
        stop = handles.stop;
        const signup = await handles.app.request("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: fixtureOrigin },
          body: JSON.stringify({
            email: `inbox-agent-tools-${randomUUID()}@rakazo.test`,
            password: "password12",
            name: "Inbox agent tools fixture",
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
        const ordinary = await rpc<{ id: string }>(handles.app, cookie, "bots/create", {
          name: "Ordinary",
          title: "",
          description: "",
          instructions: "Help with mail.",
          notifyOnFinish: false,
        });
        await discardBotIntroRun(handles, cookie, ordinary.id);
        const inbox = await rpc<{ id: string }>(handles.app, cookie, "inbox/agent");
        for (const botId of [ordinary.id, inbox.id]) {
          await rpc(handles.app, cookie, "bots/update", {
            botId,
            modelProvider: model.model.provider,
            modelId: model.model.id,
          });
        }
        const storedBot = await handles.prisma.bot.findUniqueOrThrow({
          where: { id: ordinary.id },
        });
        await handles.prisma.connection.create({
          data: {
            spaceId: storedBot.spaceId,
            userId: storedBot.userId,
            connectorId: "composio",
            provider: "gmail",
            providerRef: "acct-mail",
            displayName: "Gmail",
            status: "connected",
            metadata: { mailAddress: "me@example.test" },
          },
        });
        for (const botId of [ordinary.id, inbox.id]) {
          const sent = await rpc<{ runId: string }>(handles.app, cookie, "threads/send", {
            botId,
            text: "Hello, whats on my email.",
          });
          await expect
            .poll(
              async () =>
                (await handles.prisma.run.findUniqueOrThrow({ where: { id: sent.runId } })).status,
              { timeout: 15_000, interval: 100 },
            )
            .toBe("completed");
        }
        model.assertComplete();
        const connectorTools = (names: string[]) => names.filter((name) => /gmail/i.test(name));
        expect(connectorTools(offered.ordinary ?? [])).not.toEqual([]);
        expect(offered.inbox).toEqual(
          expect.arrayContaining(["mail_search", "mail_grep", "mail_get"]),
        );
        expect(connectorTools(offered.inbox ?? [])).toEqual([]);
        expect(systemText.inbox).not.toContain("Connected plugins");
      } finally {
        try {
          await stop?.();
        } finally {
          await model.close();
          await rm(dataDir, { recursive: true, force: true });
        }
      }
    }, 45_000);
  },
);

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
