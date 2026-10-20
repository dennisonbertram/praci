import { createHmac } from "node:crypto";
import type { AdapterContext, MessagingInboundMessage } from "@rakazo/adapter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSdkMessagingSurface } from "./chat-sdk-surface.js";
import type { MessagingEnvironmentValues } from "./messaging-platforms.js";
import { messagingPlatformsFromEnv } from "./messaging-platforms.js";
import { PhotonAdapter, PhotonError, verifySpectrumSignature } from "./photon-adapter.js";
import { createEmulatedPhotonPlatform, PhotonEmulator } from "./photon-emulator.js";

const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};
const OWNER = "+15551230001";

describe("photon webhook signature", () => {
  const secret = "s".repeat(64);
  const rawBody = '{"event":"messages"}';
  const timestamp = "1700000000";
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const verify = (over: Partial<Parameters<typeof verifySpectrumSignature>[0]> = {}) =>
    verifySpectrumSignature({ secret, signature, timestamp, rawBody, nowSec: 1700000000, ...over });

  it("accepts a valid signature inside the five minute window, on either side", () => {
    expect(verify()).toBeNull();
    expect(verify({ nowSec: 1700000000 + 300 })).toBeNull();
    expect(verify({ nowSec: 1700000000 - 300 })).toBeNull();
  });

  it("refuses stale, future, missing, malformed and wrongly signed deliveries", () => {
    expect(verify({ nowSec: 1700000000 + 301 })?.status).toBe(400);
    expect(verify({ nowSec: 1700000000 - 301 })?.status).toBe(400);
    expect(verify({ timestamp: "abc" })?.status).toBe(400);
    expect(verify({ signature: null })?.status).toBe(400);
    expect(verify({ timestamp: null })?.status).toBe(400);
    expect(verify({ signature: "v0=short" })?.status).toBe(401);
    expect(verify({ rawBody: `${rawBody} ` })?.status).toBe(401);
    expect(verify({ secret: "t".repeat(64) })?.status).toBe(401);
  });
});

describe("photon adapter", () => {
  let emulator: PhotonEmulator;
  let surface: ChatSdkMessagingSurface;
  let events: MessagingInboundMessage[];

  beforeEach(async () => {
    emulator = new PhotonEmulator();
    await emulator.start();
    surface = new ChatSdkMessagingSurface([createEmulatedPhotonPlatform(emulator)]);
    events = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") events.push(event);
    });
  });
  afterEach(() => emulator.stop());

  const post = (request: Request) => surface.handleWebhook("photon", request)!;

  it("refuses a delivery signed more than five minutes ago", async () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    const response = await post(
      emulator.buildInboundRequest({ from: OWNER, text: "late", signedAtSec: old }),
    );
    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("ignores groups, SMS, reactions, other senders' chats and non-message events with a 200", async () => {
    const ignored = [
      emulator.buildInboundRequest({
        from: OWNER,
        text: "group",
        space: { id: "any;+;chat123", platform: "iMessage", type: "group", phone: "shared" },
      }),
      emulator.buildInboundRequest({ from: OWNER, text: "sms", service: "SMS" }),
      emulator.buildInboundRequest({
        from: OWNER,
        text: "",
        content: { type: "reaction", emoji: "x", target: { id: "m" } },
      }),
      emulator.buildInboundRequest({
        from: OWNER,
        text: "spoof",
        space: { id: "any;-;+15559990000", platform: "iMessage", type: "dm", phone: "shared" },
      }),
    ];
    for (const request of ignored) expect((await post(request)).status).toBe(200);
    expect(events).toHaveLength(0);
  });

  it("passes an attachment on as a note, never a link", async () => {
    await post(
      emulator.buildInboundRequest({
        from: OWNER,
        text: "",
        content: { type: "attachment", id: "att", name: "a.jpg", mimeType: "image/jpeg" },
      }),
    );
    expect(events[0]).toMatchObject({ content: "[attachment: image/jpeg]", mediaUrl: null });
  });

  it("gives a redelivery the same handle, which the durable claim dedupes", async () => {
    await post(emulator.buildInboundRequest({ id: "spc-msg-9", from: OWNER, text: "once" }));
    // The Chat SDK's own memory drops the repeat; either way the handle is stable.
    await post(emulator.buildInboundRequest({ id: "spc-msg-9", from: OWNER, text: "once" }));
    expect(new Set(events.map((e) => e.handle))).toEqual(new Set(["spc-msg-9"]));
  });

  it("answers 5xx when inbound processing fails, and accepts the retry", async () => {
    let fail = true;
    surface.onInbound(async (event) => {
      if (fail) throw new Error("db down");
      if (event.type === "message") events.push(event);
    });
    const first = await post(
      emulator.buildInboundRequest({ id: "spc-msg-5", from: OWNER, text: "x" }),
    );
    expect(first.status).toBe(500);
    fail = false;
    const retry = await post(
      emulator.buildInboundRequest({ id: "spc-msg-5", from: OWNER, text: "x" }),
    );
    expect(retry.status).toBe(200);
    expect(events).toHaveLength(1);
  });

  it("caps a long reply at five chunks plus a short note", async () => {
    const threadId = await surface.openDirectThread("photon", OWNER, context);
    const body = Array.from({ length: 9 }, (_, i) => `para ${i} ${"x".repeat(1800)}`).join("\n\n");
    await surface.sendToThread({ threadId, body }, context);
    expect(emulator.sent).toHaveLength(6);
    expect(emulator.sent.at(-1)?.text).toBe("[Reply cut short. Ask me to continue.]");
  });

  it("sends a retried outbox row once, even from a second process", async () => {
    const threadId = await surface.openDirectThread("photon", OWNER, context);
    const body = `${"a".repeat(1500)}\n\n${"b".repeat(1500)}`;
    await surface.sendToThread({ threadId, body, idempotencyKey: "row-1" }, context);
    const other = new ChatSdkMessagingSurface([createEmulatedPhotonPlatform(emulator)]);
    await other.sendToThread({ threadId, body, idempotencyKey: "row-1" }, context);
    expect(emulator.sent).toHaveLength(2);
    await surface.sendToThread({ threadId, body, idempotencyKey: "row-2" }, context);
    expect(emulator.sent).toHaveLength(4);
  });

  it("mints the line token once and reuses it", async () => {
    const threadId = await surface.openDirectThread("photon", OWNER, context);
    await surface.sendToThread({ threadId, body: "one" }, context);
    await surface.sendToThread({ threadId, body: "two" }, context);
    expect(emulator.tokenRequests).toBe(1);
  });

  it("calls a refused token request retryable only for rate limits and server errors", async () => {
    const adapter = new PhotonAdapter({
      projectId: emulator.projectId,
      projectSecret: "wrong",
      webhookSecret: emulator.webhookSecret,
      fetch: emulator.fetch,
      address: emulator.address,
    });
    const error = await adapter.postMessage(adapter.directThreadId(OWNER), "hi").then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PhotonError);
    expect((error as PhotonError).retryable).toBe(false);
  });
});

describe("photon platform configuration", () => {
  const photon = {
    photonProjectId: "00000000-0000-4000-8000-000000000001",
    photonProjectSecret: "project-secret",
    photonWebhookSecret: "w".repeat(64),
  };
  const providers = (env: MessagingEnvironmentValues) =>
    messagingPlatformsFromEnv(env).map((platform) => platform.provider);

  it("mounts only with the project id, secret and signing secret", () => {
    expect(providers(photon)).toEqual(["photon"]);
    for (const key of Object.keys(photon) as (keyof typeof photon)[]) {
      expect(providers({ ...photon, [key]: undefined })).toEqual([]);
    }
  });

  it("turns off only Photon when its settings are bad", () => {
    const withSlack = { slackBotToken: "xoxb-1", slackSigningSecret: "sig" };
    expect(providers({ ...photon, ...withSlack })).toEqual(["slack", "photon"]);
    expect(providers({ ...photon, ...withSlack, photonWebhookSecret: "short" })).toEqual(["slack"]);
    expect(providers({ ...photon, ...withSlack, photonImessageAddress: "https://u:p@x" })).toEqual([
      "slack",
    ]);
  });

  it("mounts direct-only iMessage with typing", () => {
    expect(messagingPlatformsFromEnv(photon)[0]).toMatchObject({
      provider: "photon",
      capabilities: { direct: true, groups: false, typing: true },
    });
  });
});
