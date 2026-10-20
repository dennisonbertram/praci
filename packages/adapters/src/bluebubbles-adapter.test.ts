import { describe, expect, it, vi } from "vitest";
import {
  BLUEBUBBLES_CUT_NOTE,
  BLUEBUBBLES_MAX_CHUNK,
  BLUEBUBBLES_MAX_CHUNKS,
  BlueBubblesAdapter,
  BlueBubblesError,
  chunkIMessageText,
  memoryPollState,
  normalizeIMessageHandle,
  parseBlueBubblesServerUrl,
  parseDirectChatGuid,
  toIMessagePlainText,
} from "./bluebubbles-adapter.js";
import { BlueBubblesEmulator, createEmulatedBlueBubblesPlatform } from "./bluebubbles-emulator.js";
import { ChatSdkMessagingSurface } from "./chat-sdk-surface.js";
import { messagingPlatformsFromEnv } from "./messaging-platforms.js";

const context = {
  operationId: "op",
  traceId: "t",
  spaceId: "s",
  userId: "u",
  signal: new AbortController().signal,
};

describe("parseBlueBubblesServerUrl", () => {
  it("accepts LAN, loopback, tailnet and https tunnel hosts", () => {
    for (const url of [
      "http://192.168.1.20:1234",
      "http://localhost:1234/",
      "http://100.101.102.103:1234",
      "https://bb.example.com",
    ]) {
      expect(() => parseBlueBubblesServerUrl(url)).not.toThrow();
    }
  });

  it("refuses credentials, other schemes, metadata and link-local targets", () => {
    for (const url of [
      "not a url",
      "ftp://192.168.1.20",
      "http://user:pw@192.168.1.20",
      "http://169.254.169.254/latest",
      "http://metadata.google.internal",
      "http://[fe80::1]:1234",
    ]) {
      expect(() => parseBlueBubblesServerUrl(url), url).toThrow();
    }
  });

  it("refuses a hostname that resolves to a metadata address when sending", async () => {
    const emulator = new BlueBubblesEmulator();
    const adapter = new BlueBubblesAdapter({
      serverUrl: emulator.serverUrl,
      password: emulator.password,
      webhookToken: emulator.webhookToken,
      fetch: emulator.fetch,
      resolveHostname: async () => [{ address: "169.254.169.254", family: 4 }],
    });
    await expect(
      adapter.postMessage(adapter.directThreadId("+15551230001"), "hi"),
    ).rejects.toBeInstanceOf(BlueBubblesError);
    expect(emulator.requests).toEqual([]);
  });
});

describe("helpers", () => {
  it("normalizes phone numbers and emails to one identity", () => {
    expect(normalizeIMessageHandle("+1 (555) 123-0001")).toBe("+15551230001");
    expect(normalizeIMessageHandle("+15551230001")).toBe("+15551230001");
    expect(normalizeIMessageHandle(" Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("chunks long text under the limit without splitting a surrogate pair", () => {
    const text = `${"word ".repeat(900)}\n\n${"😀".repeat(1500)}`;
    const chunks = chunkIMessageText(text);
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(BLUEBUBBLES_MAX_CHUNK);
      expect(chunk).not.toMatch(/[\ud800-\udbff]$/);
      expect(chunk).not.toMatch(/^[\udc00-\udfff]/);
    }
    expect(chunks.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });
});

describe("bluebubbles platform", () => {
  it("mounts only with the URL, password and webhook token", () => {
    const full = {
      bluebubblesUrl: "http://192.168.1.20:1234",
      bluebubblesPassword: "pw",
      bluebubblesWebhookToken: "t".repeat(32),
    };
    expect(messagingPlatformsFromEnv(full).map((p) => p.provider)).toEqual(["bluebubbles"]);
    for (const key of Object.keys(full)) {
      expect(messagingPlatformsFromEnv({ ...full, [key]: undefined })).toEqual([]);
    }
  });

  it("disables only BlueBubbles on a bad URL or a short token, without throwing", () => {
    const base = {
      bluebubblesUrl: "http://192.168.1.20:1234",
      bluebubblesPassword: "pw",
      bluebubblesWebhookToken: "t".repeat(32),
    };
    expect(
      messagingPlatformsFromEnv({ ...base, bluebubblesUrl: "http://169.254.169.254" }),
    ).toEqual([]);
    expect(messagingPlatformsFromEnv({ ...base, bluebubblesWebhookToken: "short" })).toEqual([]);
    const withOthers = messagingPlatformsFromEnv({
      ...base,
      bluebubblesUrl: "http://169.254.169.254",
      telegramBotToken: "tg",
      telegramWebhookSecret: "secret",
    });
    expect(withOthers.map((p) => p.provider)).toEqual(["telegram"]);
  });

  it("ignores a forged webhook body: content comes from the server copy", async () => {
    const emulator = new BlueBubblesEmulator();
    const surface = new ChatSdkMessagingSurface([createEmulatedBlueBubblesPlatform(emulator)]);
    const events: unknown[] = [];
    surface.onInbound(async (event) => void events.push(event));
    const real = emulator.addMessage({ from: "+15551230001", text: "real text" });
    const response = await surface.handleWebhook(
      "bluebubbles",
      emulator.webhook(real.guid, emulator.webhookToken, {
        text: "FORGED",
        handle: { address: "+19998887777", service: "iMessage" },
      }),
    );
    expect(response?.status).toBe(200);
    expect(events).toMatchObject([{ content: "real text", from: "+15551230001" }]);
  });

  it("ignores tapbacks, SMS chats, and attachment-free empty messages; names attachments", async () => {
    const emulator = new BlueBubblesEmulator();
    const surface = new ChatSdkMessagingSurface([createEmulatedBlueBubblesPlatform(emulator)]);
    const events: { content: string; mediaUrl: string | null }[] = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") events.push(event);
    });
    for (const input of [
      { from: "+15551230001", text: "Liked “hi”", associatedMessageGuid: "p:0/x" },
      { from: "+15551230001", text: "sms text", service: "SMS" as const },
      { from: "+15551230001", text: "￼" },
    ]) {
      await surface.handleWebhook("bluebubbles", emulator.buildInboundRequest(input));
    }
    await surface.handleWebhook(
      "bluebubbles",
      emulator.buildInboundRequest({
        from: "+15551230001",
        text: "￼",
        attachmentMime: "image/jpeg",
      }),
    );
    expect(events.map((e) => e.content)).toEqual(["[attachment: image/jpeg]"]);
    expect(events[0]?.mediaUrl).toBeNull();
  });

  it("recovers a message whose webhook never arrived through the catch-up poll", async () => {
    const emulator = new BlueBubblesEmulator();
    const clock = 1_000_000;
    const platform = createEmulatedBlueBubblesPlatform(emulator, { now: () => clock });
    const surface = new ChatSdkMessagingSurface([platform]);
    const events: { handle: string }[] = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") events.push(event);
    });
    await surface.initialize();
    const missed = emulator.addMessage({
      from: "+15551230001",
      text: "missed",
      dateCreated: clock - 1000,
    });
    emulator.addMessage({ from: "+15551230001", text: "mine", isFromMe: true, dateCreated: clock });
    const adapter = platform.adapter as BlueBubblesAdapter;
    expect(await adapter.poll()).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(events.map((e) => e.handle)).toEqual([missed.guid]);
  });

  it("reuses tempGuids for one outbox key so a retry sends only the unsent chunks", async () => {
    const emulator = new BlueBubblesEmulator();
    const surface = new ChatSdkMessagingSurface([createEmulatedBlueBubblesPlatform(emulator)]);
    const threadId = await surface.openDirectThread("bluebubbles", "+15551230001", context);
    const long = `${"a".repeat(1500)}\n\n${"b".repeat(1500)}`;
    // First attempt: chunk 0 goes out, chunk 1 fails.
    const request = { threadId, body: long, idempotencyKey: "msg:m-1" };
    emulator.failTextSend(2);
    await expect(surface.sendToThread(request, context)).rejects.toThrow();
    expect(emulator.sent).toHaveLength(1);
    await surface.sendToThread(request, context);
    expect(emulator.sent.map((s) => s.text[0])).toEqual(["a", "b"]);
    expect(new Set(emulator.sent.map((s) => s.tempGuid)).size).toBe(2);
  });
});

const OWNER = "+15551230001";

async function ready(
  emulator: BlueBubblesEmulator,
  options: Parameters<typeof createEmulatedBlueBubblesPlatform>[1] = {},
  sink?: (event: { handle: string; content: string }) => Promise<void>,
) {
  const platform = createEmulatedBlueBubblesPlatform(emulator, options);
  const surface = new ChatSdkMessagingSurface([platform]);
  const events: { handle: string; content: string }[] = [];
  surface.onInbound(async (event) => {
    if (event.type !== "message") return;
    await sink?.(event);
    events.push(event);
  });
  await surface.initialize();
  return { platform, surface, events, adapter: platform.adapter as BlueBubblesAdapter };
}

describe("sends keyed on the outbox row", () => {
  it("delivers two different sends even when they share a business idempotency key", async () => {
    const emulator = new BlueBubblesEmulator();
    const { surface } = await ready(emulator);
    const threadId = await surface.openDirectThread("bluebubbles", OWNER, context);
    // Same invite text in two approval cycles: different outbox rows.
    await surface.sendToThread({ threadId, body: "approve?", idempotencyKey: "row-1" }, context);
    await surface.sendToThread({ threadId, body: "approve?", idempotencyKey: "row-2" }, context);
    expect(emulator.sent.map((s) => s.text)).toEqual(["approve?", "approve?"]);
    expect(new Set(emulator.sent.map((s) => s.tempGuid)).size).toBe(2);
    // The same row retried is recognized and not sent twice.
    await surface.sendToThread({ threadId, body: "approve?", idempotencyKey: "row-2" }, context);
    expect(emulator.sent).toHaveLength(2);
  });

  it("scopes the send id to the chat as well", async () => {
    const emulator = new BlueBubblesEmulator();
    const { surface } = await ready(emulator);
    const a = await surface.openDirectThread("bluebubbles", OWNER, context);
    const b = await surface.openDirectThread("bluebubbles", "+15551230002", context);
    await surface.sendToThread({ threadId: a, body: "hi", idempotencyKey: "row-1" }, context);
    await surface.sendToThread({ threadId: b, body: "hi", idempotencyKey: "row-1" }, context);
    expect(emulator.sent).toHaveLength(2);
  });

  it("caps a very long reply at five chunks and closes with a short note", async () => {
    const emulator = new BlueBubblesEmulator();
    const { surface } = await ready(emulator);
    const threadId = await surface.openDirectThread("bluebubbles", OWNER, context);
    const body = Array.from({ length: 12 }, (_, i) => `part ${i} ${"y".repeat(1800)}`).join("\n\n");
    await surface.sendToThread({ threadId, body, idempotencyKey: "row-9" }, context);
    expect(emulator.sent).toHaveLength(BLUEBUBBLES_MAX_CHUNKS + 1);
    expect(emulator.sent.at(-1)?.text).toBe(BLUEBUBBLES_CUT_NOTE);
  });

  it("refuses to send into a group or SMS chat guid", async () => {
    const emulator = new BlueBubblesEmulator();
    const { adapter } = await ready(emulator);
    for (const chatGuid of ["iMessage;+;chat123", "SMS;-;+15551230001"]) {
      await expect(
        adapter.postMessage(adapter.encodeThreadId({ chatGuid }), "x"),
      ).rejects.toMatchObject({ retryable: false });
    }
    expect(emulator.sent).toHaveLength(0);
  });
});

describe("a processing failure does not lose the message", () => {
  it("answers a failed webhook with a 5xx and delivers the message on the next poll", async () => {
    const emulator = new BlueBubblesEmulator();
    let fail = true;
    const { surface, events, adapter } = await ready(emulator, {}, async () => {
      if (fail) throw new Error("db down");
    });
    const request = emulator.buildInboundRequest({ from: OWNER, text: "important" });
    const response = await surface.handleWebhook("bluebubbles", request);
    expect(response?.status).toBe(500);
    expect(events).toHaveLength(0);
    fail = false;
    expect(await adapter.poll()).toBe(1);
    expect(events.map((e) => e.content)).toEqual(["important"]);
  });

  it("holds the cursor at the last success when the poll's sink fails, then retries", async () => {
    const emulator = new BlueBubblesEmulator();
    const now = 2_000_000_000_000;
    const state = memoryPollState();
    const advanced: number[] = [];
    const tracked = {
      ...state,
      advance: async (ms: number) => {
        advanced.push(ms);
        await state.advance(ms);
      },
    };
    let failOn: string | null = "second";
    const { events, adapter } = await ready(
      emulator,
      { now: () => now, pollState: tracked },
      async (event) => {
        if (event.content === failOn) throw new Error("db down");
      },
    );
    emulator.addMessage({ from: OWNER, text: "first", dateCreated: now - 3000 });
    emulator.addMessage({ from: OWNER, text: "second", dateCreated: now - 2000 });
    emulator.addMessage({ from: OWNER, text: "third", dateCreated: now - 1000 });
    await expect(adapter.poll()).rejects.toThrow();
    expect(events.map((e) => e.content)).toEqual(["first"]);
    expect(advanced.at(-1)).toBe(now - 3000);
    failOn = null;
    // The lease from the first tick has expired by the time the timer fires again.
    (state as { acquire: unknown }).acquire = memoryPollState().acquire;
    const retry = await ready(emulator, {
      now: () => now,
      pollState: { ...tracked, acquire: async () => ({ cursorMs: now - 3000 }) },
    });
    await retry.adapter.poll();
    expect(retry.events.map((e) => e.content)).toEqual(["first", "second", "third"]);
  });

  it("skips a message that has failed for over a day instead of blocking the poll", async () => {
    const emulator = new BlueBubblesEmulator();
    const now = 2_000_000_000_000;
    const day = 24 * 60 * 60_000;
    const { events, adapter } = await ready(
      emulator,
      {
        now: () => now,
        pollState: { acquire: async () => ({ cursorMs: now - 2 * day }), advance: async () => {} },
      },
      async (event) => {
        if (event.content === "poison") throw new Error("bad row");
      },
    );
    emulator.addMessage({ from: OWNER, text: "poison", dateCreated: now - 2 * day + 1 });
    emulator.addMessage({ from: OWNER, text: "fine", dateCreated: now - 1000 });
    await adapter.poll();
    expect(events.map((e) => e.content)).toEqual(["fine"]);
  });
});

describe("catch-up poll across replicas", () => {
  it("lets only the replica holding the lease poll", async () => {
    const emulator = new BlueBubblesEmulator();
    const shared = memoryPollState();
    const a = await ready(emulator, { pollState: shared, pollIntervalMs: 60_000 });
    const b = await ready(emulator, { pollState: shared, pollIntervalMs: 60_000 });
    await a.adapter.disconnect();
    await b.adapter.disconnect();
    emulator.addMessage({ from: OWNER, text: "hello", dateCreated: Date.now() - 1000 });
    expect(await a.adapter.poll()).toBe(1);
    expect(await b.adapter.poll()).toBe(0);
    expect(b.events).toHaveLength(0);
    expect(emulator.queries).toHaveLength(1);
  });

  it("never queries from a cursor in the future", async () => {
    const emulator = new BlueBubblesEmulator();
    const now = 2_000_000_000_000;
    const { adapter } = await ready(emulator, {
      now: () => now,
      pollState: { acquire: async () => ({ cursorMs: now + 3_600_000 }), advance: async () => {} },
    });
    await adapter.poll();
    expect(emulator.queries[0]?.after).toBe(now);
  });
});

describe("strict parsing", () => {
  it("accepts only E.164 phones and emails as handles", () => {
    expect(normalizeIMessageHandle("+1 (555) 123-0001")).toBe("+15551230001");
    expect(normalizeIMessageHandle("Ada@Example.com")).toBe("ada@example.com");
    for (const bad of [
      "5551230001",
      "+0123456789",
      "+1",
      "abc",
      "a@b",
      "x@@y.com",
      "",
      "+1555123000012345678",
    ]) {
      expect(normalizeIMessageHandle(bad), bad).toBeNull();
    }
  });

  it("parses only <service>;-;<id> direct chat guids", () => {
    expect(parseDirectChatGuid("iMessage;-;+15551230001")).toEqual({
      service: "iMessage",
      id: "+15551230001",
    });
    for (const bad of [
      "iMessage;+;chat1",
      "iMessage;-;",
      "iMessage",
      "",
      "iMessage;-;a;b",
      undefined,
    ]) {
      expect(parseDirectChatGuid(bad), String(bad)).toBeNull();
    }
  });

  it("drops a message whose handle claims iMessage but whose chat guid is SMS or mismatched", async () => {
    const emulator = new BlueBubblesEmulator();
    const { surface, events } = await ready(emulator);
    const sms = emulator.addMessage({ from: OWNER, text: "sms", service: "SMS" });
    sms.handle = { address: OWNER, service: "iMessage" };
    const mismatch = emulator.addMessage({ from: OWNER, text: "mismatch" });
    mismatch.handle = { address: "+15559998888", service: "iMessage" };
    const badHandle = emulator.addMessage({ from: "5551230001", text: "no plus" });
    for (const message of [sms, mismatch, badHandle]) {
      await surface.handleWebhook("bluebubbles", emulator.webhook(message.guid));
    }
    expect(events).toHaveLength(0);
  });
});

describe("server URL handling", () => {
  it("keeps the configured path prefix and the origin", async () => {
    const emulator = new BlueBubblesEmulator();
    const seen: string[] = [];
    const adapter = new BlueBubblesAdapter({
      serverUrl: "http://bluebubbles.test:1234/bb/",
      password: emulator.password,
      webhookToken: emulator.webhookToken,
      resolveHostname: async () => [{ address: "192.168.1.20", family: 4 }],
      fetch: async (input) => {
        seen.push(new URL(String(input)).pathname);
        return Response.json({ status: 200, data: { guid: "g" } });
      },
    });
    await adapter.postMessage(adapter.directThreadId(OWNER), "hi");
    expect(seen).toEqual(["/bb/api/v1/message/text"]);
  });

  it("rejects a base path with // and a guid that tries to leave the API prefix", async () => {
    expect(() => parseBlueBubblesServerUrl("http://192.168.1.20:1234//evil")).toThrow(/\/\//);
    const emulator = new BlueBubblesEmulator();
    const { adapter } = await ready(emulator);
    const fetchByGuid = (adapter as unknown as { fetchByGuid(guid: string): Promise<unknown> })
      .fetchByGuid;
    await expect(fetchByGuid.call(adapter, "..")).rejects.toThrow();
    expect(emulator.requests).toEqual([]);
  });

  it("strips a trailing dot before the metadata check", () => {
    expect(() => parseBlueBubblesServerUrl("http://metadata.google.internal.:80")).toThrow();
  });

  it("pins the connection to the addresses it validated", async () => {
    const lookups: string[] = [];
    const adapter = new BlueBubblesAdapter({
      serverUrl: "http://bb.example.test:1234",
      password: "pw",
      webhookToken: "t".repeat(32),
      resolveHostname: async (host) => {
        lookups.push(host);
        return [{ address: "169.254.169.254", family: 4 }];
      },
      fetch: async () => Response.json({ status: 200, data: {} }),
    });
    await expect(adapter.check()).rejects.toMatchObject({ retryable: false });
    expect(lookups).toEqual(["bb.example.test"]);
  });
});

describe("webhook token handling", () => {
  it("requires a token of at least 32 characters", () => {
    expect(
      () =>
        new BlueBubblesAdapter({
          serverUrl: "http://192.168.1.20:1234",
          password: "pw",
          webhookToken: "x".repeat(31),
        }),
    ).toThrow(/32/);
  });

  it("logs a bad token at most once a minute", async () => {
    const emulator = new BlueBubblesEmulator();
    const warn = vi.fn();
    const logger = { warn, info() {}, debug() {}, error() {}, child: () => logger };
    let clock = 1_000_000;
    const adapter = new BlueBubblesAdapter({
      serverUrl: emulator.serverUrl,
      password: emulator.password,
      webhookToken: emulator.webhookToken,
      fetch: emulator.fetch,
      logger: logger as never,
      now: () => clock,
    });
    for (let i = 0; i < 5; i += 1) {
      const response = await adapter.handleWebhook(emulator.webhook("g", "wrong"));
      expect(response.status).toBe(401);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    clock += 61_000;
    await adapter.handleWebhook(emulator.webhook("g", "wrong"));
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("plain text rendering", () => {
  it("keeps literal asterisks in arithmetic and globs", () => {
    expect(toIMessagePlainText("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(toIMessagePlainText("a*b*c and 5*3 = 15")).toBe("a*b*c and 5*3 = 15");
    expect(toIMessagePlainText("match *.js and *.ts files")).toBe("match *.js and *.ts files");
  });

  it("strips emphasis that wraps text", () => {
    expect(toIMessagePlainText("**bold** and *italic* and ***both***")).toBe(
      "bold and italic and both",
    );
    expect(toIMessagePlainText("[docs](https://example.com)")).toBe("docs (https://example.com)");
  });
});
