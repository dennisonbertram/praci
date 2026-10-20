import {
  BlueBubblesAdapter,
  type BlueBubblesAdapterConfig,
  type BlueBubblesRawMessage,
  bluebubblesTransport,
} from "./bluebubbles-adapter.js";
import type { MessagingPlatform } from "./chat-sdk-surface.js";

export interface BlueBubblesEmulatorMessage {
  guid?: string;
  from: string;
  text: string;
  /** Service of the sender's chat; "SMS" exercises the transport gate. */
  service?: "iMessage" | "SMS";
  isFromMe?: boolean;
  /** Reaction (tapback) target; marks the message as an association. */
  associatedMessageGuid?: string;
  dateCreated?: number;
  attachmentMime?: string;
  /** Chat the message belongs to; defaults to the direct chat with `from`. A `;+;` guid is a group. */
  chatGuid?: string;
}

/**
 * Deterministic BlueBubbles server for offline tests: serves the REST routes
 * the adapter uses over an injected fetch, records outbound sends, and builds
 * the unsigned webhook posts the real server would send.
 */
export class BlueBubblesEmulator {
  readonly serverUrl = "http://bluebubbles.test:1234";
  readonly password = "emulated-server-password";
  readonly webhookToken = "emulated-webhook-token-0123456789abcdef";
  readonly line = "+15550009999";
  readonly sent: { chatGuid: string; text: string; tempGuid: string; guid: string }[] = [];
  readonly messages = new Map<string, BlueBubblesRawMessage>();
  /** Every request path the adapter made, in order. */
  readonly requests: string[] = [];
  /** Body of each POST /message/query, for cursor assertions. */
  readonly queries: { after?: number; limit?: number }[] = [];
  private counter = 0;
  private failures: { remaining: number; status: number } = { remaining: 0, status: 500 };
  private textSends = 0;
  private failAtSend: number | null = null;

  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.origin !== this.serverUrl) {
      throw new Error(`BlueBubbles emulator received unexpected URL ${url.origin}`);
    }
    const method = init?.method?.toUpperCase() ?? "GET";
    const path = url.pathname.replace("/api/v1", "");
    this.requests.push(`${method} ${path}`);
    if (url.searchParams.get("guid") !== this.password) {
      return Response.json(
        { status: 401, message: "Server password is incorrect" },
        { status: 401 },
      );
    }
    if (path === "/ping") return Response.json({ status: 200, data: "pong" });
    if (path === "/server/info")
      return Response.json({ status: 200, data: { private_api: false } });
    if (path === "/message/text" && method === "POST") {
      this.textSends += 1;
      if (this.failAtSend === this.textSends) {
        return Response.json({ status: 500 }, { status: 500 });
      }
      if (this.failures.remaining > 0) {
        this.failures.remaining -= 1;
        return Response.json({ status: this.failures.status }, { status: this.failures.status });
      }
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      const guid = this.nextGuid("sent");
      this.sent.push({
        chatGuid: body.chatGuid ?? "",
        text: body.message ?? "",
        tempGuid: body.tempGuid ?? "",
        guid,
      });
      return Response.json({ status: 200, data: { guid, tempGuid: body.tempGuid } });
    }
    if (path === "/message/query" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as {
        after?: number;
        limit?: number;
        offset?: number;
        chatGuid?: string;
        sort?: string;
      };
      this.queries.push(body);
      const direction = body.sort === "DESC" ? -1 : 1;
      const rows = [...this.messages.values()]
        .filter((m) => (m.dateCreated ?? 0) >= (body.after ?? 0))
        .filter((m) => !body.chatGuid || m.chats?.[0]?.guid === body.chatGuid)
        .sort((a, b) => direction * ((a.dateCreated ?? 0) - (b.dateCreated ?? 0)))
        .slice(body.offset ?? 0, (body.offset ?? 0) + (body.limit ?? 100));
      return Response.json({ status: 200, data: rows });
    }
    if (path === "/chat/query" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { limit?: number; offset?: number };
      const newest = new Map<string, BlueBubblesRawMessage>();
      for (const message of this.messages.values()) {
        const guid = message.chats?.[0]?.guid ?? "";
        const known = newest.get(guid);
        if (!known || (message.dateCreated ?? 0) > (known.dateCreated ?? 0)) {
          newest.set(guid, message);
        }
      }
      const chats = [...newest.entries()]
        .sort(([, a], [, b]) => (b.dateCreated ?? 0) - (a.dateCreated ?? 0))
        .slice(body.offset ?? 0, (body.offset ?? 0) + (body.limit ?? 100))
        .map(([guid, lastMessage]) => ({
          guid,
          displayName: "",
          chatIdentifier: guid.split(";").at(-1),
          lastMessage,
        }));
      return Response.json({ status: 200, data: chats });
    }
    const single = /^\/message\/([^/]+)$/.exec(path);
    if (single && method === "GET") {
      const message = this.messages.get(decodeURIComponent(single[1]!));
      return message
        ? Response.json({ status: 200, data: message })
        : Response.json({ status: 404, message: "Message does not exist!" }, { status: 404 });
    }
    throw new Error(`BlueBubbles emulator received unexpected request ${method} ${path}`);
  };

  /** Next N text sends fail with this HTTP status. */
  failNextSends(count: number, status = 500): void {
    this.failures = { remaining: count, status };
  }

  /** Fail only the nth text send from now on (1-based, counted from this call). */
  failTextSend(nth: number): void {
    this.failAtSend = this.textSends + nth;
  }

  /** Store a message on the "server" and return it as the REST API would. */
  addMessage(input: BlueBubblesEmulatorMessage): BlueBubblesRawMessage {
    const service = input.service ?? "iMessage";
    const message: BlueBubblesRawMessage = {
      guid: input.guid ?? this.nextGuid("in"),
      text: input.text,
      isFromMe: input.isFromMe ?? false,
      dateCreated: input.dateCreated ?? Date.now(),
      itemType: 0,
      groupActionType: 0,
      associatedMessageGuid: input.associatedMessageGuid ?? null,
      handle: { address: input.from, service },
      chats: [{ guid: input.chatGuid ?? `${service};-;${input.from}` }],
      attachments: input.attachmentMime ? [{ guid: "att-1", mimeType: input.attachmentMime }] : [],
    };
    this.messages.set(message.guid, message);
    return message;
  }

  /** A new-message webhook exactly as the server posts it (JSON, no signature). */
  buildInboundRequest(input: BlueBubblesEmulatorMessage, token = this.webhookToken): Request {
    const message = this.addMessage(input);
    return this.webhook(message.guid, token);
  }

  /** A webhook that points at a guid, optionally with a body the server never stored. */
  webhook(guid: string, token = this.webhookToken, body?: Record<string, unknown>): Request {
    return new Request(
      `https://rakazo.test/api/v1/messaging/webhook/bluebubbles?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "new-message", data: { guid, ...body } }),
      },
    );
  }

  private nextGuid(prefix: string): string {
    this.counter += 1;
    return `${prefix}-guid-${this.counter}`;
  }
}

/** The production bluebubbles platform with only the HTTP boundary swapped. */
export function createEmulatedBlueBubblesPlatform(
  emulator: BlueBubblesEmulator,
  options: Partial<BlueBubblesAdapterConfig> = {},
): MessagingPlatform {
  const adapter = new BlueBubblesAdapter({
    serverUrl: emulator.serverUrl,
    password: emulator.password,
    webhookToken: emulator.webhookToken,
    fetch: emulator.fetch,
    resolveHostname: async () => [{ address: "192.168.1.20", family: 4 }],
    pollIntervalMs: 0,
    ...options,
  });
  return {
    provider: "bluebubbles",
    capabilities: { direct: true, groups: false, typing: false },
    adapter,
    history: adapter,
    directThreadId: (address) => adapter.directThreadId(address),
    transport: bluebubblesTransport,
  };
}
