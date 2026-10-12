import type { AdapterContext, JobPublisher, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createLogger, createTestSink, getLogger, installLogger } from "@rakazo/logging";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncMailbox } from "./mail-sync.js";

const account: MailAccount = {
  id: "conn-1",
  connectorId: "composio",
  app: "gmail",
  accountRef: "ca-1",
  label: "Test",
  spaceId: "space-1",
  userId: "user-1",
  address: "me@example.test",
};

function setup(listMessages: MailProvider["listMessages"]) {
  const statements: string[] = [];
  const prisma = {
    $executeRaw: async (strings: TemplateStringsArray) => {
      statements.push(strings.join("?"));
      return 1;
    },
    $queryRaw: async () => [{ connectionId: account.id }],
  } as unknown as PrismaClient;
  const mail = { listMessages } as unknown as MailProvider;
  const jobs = { enqueue: async () => {} } as unknown as JobPublisher;
  const run = (signal: AbortSignal, extra: { deadlineMs?: number } = {}) => {
    const context: AdapterContext = {
      operationId: "op",
      traceId: "op",
      spaceId: account.spaceId,
      userId: account.userId,
      signal,
    };
    return syncMailbox({ prisma, mail, jobs, ...extra }, account, context);
  };
  const lastUpdate = () => statements.at(-1) ?? "";
  return { run, lastUpdate };
}

describe("syncMailbox provider failures", () => {
  const sink = createTestSink();
  const previous = getLogger();
  beforeEach(() => {
    sink.events.length = 0;
    installLogger(createLogger({ service: "test", level: "debug", sinks: [sink] }));
  });
  afterEach(() => installLogger(previous));

  it("records the failure with its sanitized detail in the log and on the state row", async () => {
    const { run, lastUpdate } = setup(async () => {
      throw new MailProviderError(
        "unavailable",
        "Mail request failed",
        undefined,
        "InternalServerError status=502: 502 bad gateway",
      );
    });
    expect(await run(new AbortController().signal)).toBe("failed");
    expect(lastUpdate()).toContain('"lastErrorAt" =');
    const warning = sink.events.find((e) => e.message === "mail sync failed");
    expect(warning).toMatchObject({
      level: "warn",
      reason: "unavailable",
      detail: "InternalServerError status=502: 502 bad gateway",
    });
  });

  it("still records a failure when only the sync deadline expired", async () => {
    const { run, lastUpdate } = setup(async (_account, _request, context) => {
      await new Promise<void>((resolve) =>
        context.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      throw new MailProviderError("unavailable", "Mail request aborted");
    });
    expect(await run(new AbortController().signal, { deadlineMs: 20 })).toBe("failed");
    expect(lastUpdate()).toContain('"lastErrorAt" =');
  });

  it("does not record a failure when the caller went away, and frees the claim", async () => {
    const controller = new AbortController();
    const { run, lastUpdate } = setup(async () => {
      controller.abort();
      throw new MailProviderError("unavailable", "Mail request aborted");
    });
    expect(await run(controller.signal)).toBe("skipped");
    expect(lastUpdate()).not.toContain("lastErrorAt");
    expect(lastUpdate()).toContain('"claimToken" = NULL');
    expect(sink.events.some((e) => e.message === "mail sync failed")).toBe(false);
    expect(sink.events.find((e) => e.message === "mail sync cancelled")).toMatchObject({
      level: "info",
    });
  });
});
