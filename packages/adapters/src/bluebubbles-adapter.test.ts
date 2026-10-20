import { describe, expect, it } from "vitest";
import {
  BLUEBUBBLES_MAX_CHUNK,
  BlueBubblesAdapter,
  BlueBubblesError,
  chunkIMessageText,
  normalizeIMessageHandle,
  parseBlueBubblesServerUrl,
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
      bluebubblesWebhookToken: "tok",
    };
    expect(messagingPlatformsFromEnv(full).map((p) => p.provider)).toEqual(["bluebubbles"]);
    for (const key of Object.keys(full)) {
      expect(messagingPlatformsFromEnv({ ...full, [key]: undefined })).toEqual([]);
    }
  });

  it("rejects an SSRF-unsafe URL at startup instead of mounting", () => {
    expect(() =>
      messagingPlatformsFromEnv({
        bluebubblesUrl: "http://169.254.169.254",
        bluebubblesPassword: "pw",
        bluebubblesWebhookToken: "tok",
      }),
    ).toThrow(/blocked/);
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
