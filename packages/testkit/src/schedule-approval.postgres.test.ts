import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ComposioEmulator } from "@rakazo/adapters";
import { describe, expect, it } from "vitest";
import { discardBotIntroRun } from "./discard-bot-intro.js";
import { sessionCookieHeader } from "./index.js";
import { startModelEmulator } from "./model-emulator.js";

type App = { request: (input: string, init?: RequestInit) => Promise<Response> };
const databaseAvailable = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);
const fixtureOrigin = "http://127.0.0.1:5173";

describe.skipIf(!databaseAvailable)("offline schedule approval", () => {
  const cases = [
    {
      name: "pauses a repeating schedule for approval, then creates it in the user's zone",
      args: { name: "Digest", prompt: "Summarize my unread mail", cron: "30 7 * * *" },
      asks: true,
    },
    {
      name: "creates a one-off reminder without asking",
      args: { name: "Call back", prompt: "Remind me to call back", delayMinutes: 30 },
      asks: false,
    },
  ];
  it.each(cases)(
    "$name",
    async ({ args, asks }) => {
      const fixtureKey = "offline-schedule-approval-key";
      const model = await startModelEmulator({
        apiKey: fixtureKey,
        steps: [
          {
            expect(request) {
              expect(request.tools).toContainEqual(
                expect.objectContaining({
                  function: expect.objectContaining({ name: "schedule_create" }),
                }),
              );
              // The per-turn time line carries the user's local time.
              expect(JSON.stringify(request.messages)).toContain("in America/New_York");
            },
            response: {
              type: "tool",
              id: "make-schedule",
              name: "schedule_create",
              arguments: args,
            },
          },
          // After approval the run resumes and the model repeats the call; the saved one runs.
          ...(asks
            ? [
                {
                  expect() {},
                  response: {
                    type: "tool" as const,
                    id: "resumed-schedule",
                    name: "schedule_create",
                    arguments: args,
                  },
                },
              ]
            : []),
          { expect() {}, response: { type: "text", text: "Done." } },
        ],
      });
      const dataDir = await mkdtemp(path.join(tmpdir(), "rakazo-schedule-approval-"));
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
          encryptionKey: "offline-schedule-fixture-encryption-key",
        });
        stop = handles.stop;
        const signup = await handles.app.request("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: fixtureOrigin },
          body: JSON.stringify({
            email: `schedule-approval-${randomUUID()}@rakazo.test`,
            password: "password12",
            name: "Schedule approval fixture",
          }),
        });
        expect(signup.status).toBeLessThan(400);
        const cookie = sessionCookieHeader(signup);
        await rpc(handles.app, cookie, "preferences/update", { timezone: "America/New_York" });
        await rpc(handles.app, cookie, "models/connect", {
          provider: model.model.provider,
          modelId: model.model.id,
          baseUrl: model.baseUrl,
          apiKey: fixtureKey,
          contextWindow: 160_000,
          maxTokens: 4096,
        });
        const bot = await rpc<{ id: string }>(handles.app, cookie, "bots/create", {
          name: "Scheduler",
          title: "",
          description: "",
          instructions: "Schedule what the user asks.",
          notifyOnFinish: false,
        });
        await discardBotIntroRun(handles, cookie, bot.id);
        await rpc(handles.app, cookie, "bots/update", {
          botId: bot.id,
          modelProvider: model.model.provider,
          modelId: model.model.id,
        });
        const sent = await rpc<{ runId: string }>(handles.app, cookie, "threads/send", {
          botId: bot.id,
          text: "Set that up.",
        });
        const waitForRun = (status: string) =>
          expect
            .poll(
              async () => {
                const run = await handles.prisma.run.findUniqueOrThrow({
                  where: { id: sent.runId },
                });
                if (run.status === "failed") model.assertComplete();
                return run.status;
              },
              { timeout: 15_000, interval: 100 },
            )
            .toBe(status);
        const savedRoutines = () => handles.prisma.routine.findMany({ where: { botId: bot.id } });

        if (!asks) {
          await waitForRun("completed");
          const [routine] = await savedRoutines();
          expect(routine).toMatchObject({ name: "Call back", timezone: "America/New_York" });
          return;
        }
        await waitForRun("waiting_input");
        expect(await savedRoutines()).toHaveLength(0);
        const card = await handles.prisma.message.findFirstOrThrow({
          where: { runId: sent.runId, role: "bot" },
          orderBy: { seq: "desc" },
        });
        const ask = (card.blocks as Array<Record<string, unknown>>).find((b) => b.kind === "ask");
        expect(ask?.text).toBe("Review before creating the repeating schedule “Digest”");
        expect(ask?.detail).toContain("repeats: Every day at 7:30 AM (America/New_York)");
        expect(ask?.detail).toContain("prompt: Summarize my unread mail");
        await rpc(handles.app, cookie, "threads/answer", {
          botId: bot.id,
          runId: sent.runId,
          messageId: card.id,
          answer: "allow",
        });
        await waitForRun("completed");
        model.assertComplete();
        expect(await savedRoutines()).toMatchObject([
          { name: "Digest", prompt: "Summarize my unread mail", timezone: "America/New_York" },
        ]);
      } finally {
        try {
          await stop?.();
        } finally {
          await model.close();
          await rm(dataDir, { recursive: true, force: true });
        }
      }
    },
    45_000,
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
