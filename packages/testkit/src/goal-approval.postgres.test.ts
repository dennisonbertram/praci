import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ComposioEmulator } from "@rakazo/adapters";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { discardBotIntroRun } from "./discard-bot-intro.js";
import { sessionCookieHeader } from "./index.js";
import { startModelEmulator } from "./model-emulator.js";

type App = { request: (input: string, init?: RequestInit) => Promise<Response> };
const databaseAvailable = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);
const fixtureOrigin = "http://127.0.0.1:5173";

describe.skipIf(!databaseAvailable)("offline Pi goal runs with approved calls", () => {
  beforeAll(() => {
    vi.stubEnv("RAKAZO_OPENAI_COMPATIBLE_VISION_MODELS", "offline-fixture");
    // web_fetch answers from the in-memory page instead of the network.
    vi.stubEnv("WEB_PROVIDER", "fake");
  });
  afterAll(() => vi.unstubAllEnvs());

  it.each([
    {
      tool: "computer_act",
      args: {
        actions: [{ kind: "type", text: "approved clipboard content" }],
        observe: false,
        settle_ms: 0,
      },
      rule: true,
    },
    // A site the run has not seen asks without any rule.
    { tool: "web_fetch", args: { url: "https://example.test/page" }, rule: false },
  ])(
    "counts every approved $tool call as progress, so the goal is not stalled",
    async ({ tool, args, rule }) => {
      const verdict = (kind: "continue" | "met", evidence: string[]) => ({
        expect() {},
        response: {
          type: "text" as const,
          text: JSON.stringify({
            verdict: kind,
            reason: "Checked.",
            evidence,
            next: "Do it again.",
          }),
        },
      });
      const work = (id: string) => [
        {
          expect() {},
          response: { type: "tool" as const, id, name: tool, arguments: args },
        },
        { expect() {}, response: { type: "text" as const, text: "Done." } },
      ];
      const fixtureKey = "offline-goal-approval-key";
      const model = await startModelEmulator({
        apiKey: fixtureKey,
        // Three runs. Every continuation is restricted after the first run used an outside tool,
        // so each of their calls asks the owner too.
        steps: [
          ...work("c1"),
          verdict("continue", []),
          ...work("c2"),
          verdict("continue", []),
          ...work("c3"),
          verdict("met", ["r3.t1"]),
        ],
      });
      const dataDir = await mkdtemp(path.join(tmpdir(), "rakazo-goal-approval-"));
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
          composio: new ComposioEmulator(),
          encryptionKey: "offline-goal-fixture-encryption-key",
        });
        stop = handles.stop;
        const signup = await handles.app.request("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: fixtureOrigin },
          body: JSON.stringify({
            email: `goal-approval-${randomUUID()}@rakazo.test`,
            password: "password12",
            name: "Goal approval fixture",
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
          name: "Goal fixture",
          title: "",
          description: "",
          instructions: "Complete the computer task.",
          notifyOnFinish: false,
        });
        await discardBotIntroRun(handles, cookie, bot.id);
        await rpc(handles.app, cookie, "bots/update", {
          botId: bot.id,
          modelProvider: model.model.provider,
          modelId: model.model.id,
        });
        const storedBot = await handles.prisma.bot.findUniqueOrThrow({ where: { id: bot.id } });
        if (rule) {
          await handles.prisma.actionApprovalRule.create({
            data: {
              spaceId: storedBot.spaceId,
              createdByUserId: storedBot.userId,
              effect: "require_approval",
              matchKind: "tool",
              matchValue: tool,
            },
          });
        }
        await rpc(handles.app, cookie, "threads/send", {
          botId: bot.id,
          text: "/goal put approved clipboard content on the computer clipboard",
        });
        const goalOf = () =>
          handles.prisma.threadGoal.findFirstOrThrow({ where: { thread: { botId: bot.id } } });
        // Act as the owner: allow every card (AI data sharing consent, then each computer action).
        for (let i = 0; i < 100 && (await goalOf()).status === "active"; i++) {
          const waiting = await handles.prisma.run.findFirst({
            where: { botId: bot.id, status: "waiting_input" },
          });
          if (waiting) {
            const card = await handles.prisma.message.findFirstOrThrow({
              where: { runId: waiting.id, role: "bot" },
              orderBy: { seq: "desc" },
            });
            await rpc(handles.app, cookie, "threads/answer", {
              botId: bot.id,
              runId: waiting.id,
              messageId: card.id,
              answer: "allow",
            }).catch(() => undefined);
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const runs = await handles.prisma.run.findMany({
          where: { botId: bot.id, goalId: { not: null } },
          orderBy: { createdAt: "asc" },
        });
        expect(runs.map((run) => [run.trigger, run.status])).toEqual([
          ["user", "completed"],
          ["goal", "completed"],
          ["goal", "completed"],
        ]);
        for (const run of runs) {
          expect(run.goalEvidence).toMatchObject([{ id: "t1", tool, ok: true }]);
        }
        expect(await goalOf()).toMatchObject({ status: "met", stalls: 0 });
        model.assertComplete();
      } finally {
        try {
          await stop?.();
        } finally {
          await model.close();
          await rm(dataDir, { recursive: true, force: true });
        }
      }
    },
    90_000,
  );
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
