import type { AdapterContext, MessagingInboundMessage } from "@rakazo/adapter-kit";
import { ChatSdkMessagingSurface, type MessagingPlatform } from "@rakazo/adapters";
import { afterEach, describe, expect, it } from "vitest";

/**
 * What the suite needs from one messaging platform wired to a fake vendor:
 * the real platform object, requests the real vendor would send, and the
 * sends the fake vendor recorded. Each case builds a fresh harness.
 */
export interface MessagingPlatformHarness {
  /** Valid after `start()` when the harness has one. */
  readonly platform: MessagingPlatform;
  /** Bring up a fake vendor that needs a listening socket. */
  start?(): Promise<void>;
  stop?(): Promise<void>;
  /** An authentic inbound direct message from `from`. */
  inbound(input: { from: string; text: string; handle?: string }): Request;
  /** Same shape as `inbound`, but failing the vendor's signature or token check. */
  forged(input: { from: string; text: string }): Request;
  /** A message our own line sent, echoed back by the vendor. */
  ownEcho(input: { text: string }): Request;
  /** An authentic inbound message over a transport that must not wake an agent. */
  otherTransport?(input: { from: string; text: string }): Request;
  /** Texts the fake vendor recorded as sent, in order. */
  sentTexts(): string[];
  /** Make the next `count` sends fail with this HTTP status. */
  failNextSends(count: number, status: number): void;
  /** Largest chunk the platform promises to send; omit if it never splits. */
  maxChunkLength?: number;
  /** True when thrown send errors carry a boolean `retryable` classification. */
  classifiesErrors?: boolean;
}

const context: AdapterContext = {
  operationId: "op-conformance",
  traceId: "trace-conformance",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};

const OWNER = "+15551230001";

/** Offline contract every messaging platform (Sendblue, BlueBubbles, Photon, ...) must meet. */
export function describeMessagingPlatformConformance(
  name: string,
  create: () => MessagingPlatformHarness,
): void {
  const started: MessagingPlatformHarness[] = [];
  afterEach(async () => {
    await Promise.all(started.splice(0).map((harness) => harness.stop?.()));
  });

  async function setup() {
    const harness = create();
    started.push(harness);
    await harness.start?.();
    const surface = new ChatSdkMessagingSurface([harness.platform]);
    const messages: MessagingInboundMessage[] = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") messages.push(event);
    });
    const provider = harness.platform.provider;
    return { harness, surface, messages, provider };
  }

  describe(`messaging platform conformance: ${name}`, () => {
    it("turns an authentic direct message into one provider-neutral inbound event", async () => {
      const { harness, surface, messages, provider } = await setup();
      const response = await surface.handleWebhook(
        provider,
        harness.inbound({ from: OWNER, text: "hello agent" }),
      );
      expect(response?.status).toBe(200);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        provider,
        from: OWNER,
        content: "hello agent",
        isDirect: true,
      });
      expect(messages[0]?.handle).toBeTruthy();
      expect(messages[0]?.threadId.startsWith(`${provider}:`)).toBe(true);
    });

    it("rejects a forged signature or token and produces no event", async () => {
      const { harness, surface, messages, provider } = await setup();
      const response = await surface.handleWebhook(
        provider,
        harness.forged({ from: OWNER, text: "forged" }),
      );
      expect(response?.status).toBeGreaterThanOrEqual(400);
      expect(response?.status).toBeLessThan(500);
      expect(messages).toHaveLength(0);
    });

    it("gives a replayed delivery the same handle so the downstream nonce dedupes it", async () => {
      const { harness, surface, messages, provider } = await setup();
      const request = () => harness.inbound({ from: OWNER, text: "twice", handle: "replay-1" });
      await surface.handleWebhook(provider, request());
      await surface.handleWebhook(provider, request());
      expect(messages.length).toBeGreaterThanOrEqual(1);
      expect(new Set(messages.map((m) => m.handle)).size).toBe(1);
    });

    it("never surfaces our own outgoing messages", async () => {
      const { harness, surface, messages, provider } = await setup();
      const response = await surface.handleWebhook(provider, harness.ownEcho({ text: "echo" }));
      expect(response?.status).toBe(200);
      expect(messages).toHaveLength(0);
    });

    it("sends text to the thread an inbound message came from", async () => {
      const { harness, surface, messages, provider } = await setup();
      await surface.handleWebhook(provider, harness.inbound({ from: OWNER, text: "hi" }));
      const sent = await surface.sendToThread(
        { threadId: messages[0]!.threadId, body: "hello" },
        context,
      );
      expect(sent.handle).toBeTruthy();
      expect(harness.sentTexts()).toEqual(["hello"]);
    });

    it("opens the direct thread for an address and sends into it", async () => {
      const { harness, surface, provider } = await setup();
      const threadId = await surface.openDirectThread(provider, OWNER, context);
      expect(threadId.startsWith(`${provider}:`)).toBe(true);
      await surface.sendToThread({ threadId, body: "proactive" }, context);
      expect(harness.sentTexts()).toEqual(["proactive"]);
    });

    it("rejects a send the vendor refused, so the outbox retries it", async () => {
      const { harness, surface, provider } = await setup();
      const threadId = await surface.openDirectThread(provider, OWNER, context);
      harness.failNextSends(1, 503);
      const error = await surface.sendToThread({ threadId, body: "will fail" }, context).then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(Error);
      if (harness.classifiesErrors) expect((error as { retryable: boolean }).retryable).toBe(true);
      await surface.sendToThread({ threadId, body: "second try" }, context);
      expect(harness.sentTexts().at(-1)).toBe("second try");
    });

    if (create().classifiesErrors) {
      it("separates retryable from permanent send errors", async () => {
        const { harness, surface, provider } = await setup();
        const threadId = await surface.openDirectThread(provider, OWNER, context);
        const failure = async (status: number) => {
          harness.failNextSends(1, status);
          return surface.sendToThread({ threadId, body: "x" }, context).then(
            () => null,
            (e: unknown) => e as { retryable: boolean },
          );
        };
        expect((await failure(429))?.retryable).toBe(true);
        expect((await failure(500))?.retryable).toBe(true);
        expect((await failure(400))?.retryable).toBe(false);
        expect((await failure(401))?.retryable).toBe(false);
      });
    }

    const otherTransport = create().otherTransport;
    if (otherTransport) {
      it("ignores messages from a transport that must not wake an agent", async () => {
        const { harness, surface, messages, provider } = await setup();
        await surface.handleWebhook(
          provider,
          harness.otherTransport!({ from: OWNER, text: "from sms" }),
        );
        expect(messages).toHaveLength(0);
      });
    }

    const limit = create().maxChunkLength;
    if (limit) {
      it("splits a long reply into ordered chunks within the limit", async () => {
        const { harness, surface, provider } = await setup();
        const threadId = await surface.openDirectThread(provider, OWNER, context);
        const body = Array.from({ length: 6 }, (_, i) => `para ${i} ${"x".repeat(900)}`).join(
          "\n\n",
        );
        await surface.sendToThread({ threadId, body }, context);
        const sent = harness.sentTexts();
        expect(sent.length).toBeGreaterThan(1);
        for (const text of sent) expect(text.length).toBeLessThanOrEqual(limit);
        expect(sent.join("\n\n").replace(/\s/g, "")).toBe(body.replace(/\s/g, ""));
      });
    }
  });
}
