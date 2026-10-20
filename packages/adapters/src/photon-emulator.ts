import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { MessagingPlatform } from "./chat-sdk-surface.js";
import { PhotonAdapter, type PhotonAdapterConfig, photonTransport } from "./photon-adapter.js";

export interface PhotonEmulatorMessage {
  id?: string;
  from: string;
  text: string;
  /** "SMS" exercises the transport gate. */
  service?: "iMessage" | "SMS";
  direction?: "inbound" | "outbound";
  /** Seconds since the epoch used to sign the delivery. */
  signedAtSec?: number;
  space?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

export interface PhotonEmulatorHistoryMessage {
  from: string;
  text: string;
  isFromMe?: boolean;
  /** "SMS" exercises the transport gate. */
  service?: "iMessage" | "SMS";
  /** Defaults to the direct chat `any;-;<from>`. A `;+;` guid is a group. */
  chatGuid?: string;
  at?: Date;
  attachmentMime?: string;
  reaction?: boolean;
}

/**
 * Deterministic Photon for offline tests: a loopback HTTP server that speaks
 * the iMessage HTTP routes the SDK calls, a fetch that answers the Spectrum
 * Cloud token request, and builders for the signed webhook posts Spectrum
 * would send. Nothing leaves the machine.
 */
export class PhotonEmulator {
  readonly projectId = "00000000-0000-4000-8000-000000000001";
  readonly projectSecret = "emulated-project-secret";
  readonly webhookSecret = "a".repeat(64);
  readonly line = "+15550009999";
  /** Messages the history routes serve. */
  readonly history: (PhotonEmulatorHistoryMessage & { guid: string; at: Date })[] = [];
  readonly sent: { chatGuid: string; text: string; clientMessageId: string; guid: string }[] = [];
  /** Request paths the iMessage server saw, in order. */
  readonly requests: string[] = [];
  /** How many token requests the Cloud fetch answered. */
  tokenRequests = 0;
  private server: Server | undefined;
  private baseUrl = "";
  private counter = 0;
  private failures = { remaining: 0, status: 500 };

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const url = new URL(request.url ?? "", "http://photon.test");
        const path = url.pathname;
        this.requests.push(`${request.method} ${path}`);
        if (request.headers.authorization !== "Bearer emulated-line-token") {
          response.writeHead(401).end();
          return;
        }
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, string>;
        if (path === "/v1/messages:sendText") {
          if (this.failures.remaining > 0) {
            this.failures.remaining -= 1;
            response.writeHead(this.failures.status).end();
            return;
          }
          // The vendor drops a repeated client message id and returns the first send.
          const known = this.sent.find((s) => s.clientMessageId === body.clientMessageId);
          const guid = known?.guid ?? this.nextGuid("sent");
          if (!known) {
            this.sent.push({
              chatGuid: body.chatGuid ?? "",
              text: body.text ?? "",
              clientMessageId: body.clientMessageId ?? "",
              guid,
            });
          }
          response.writeHead(200, { "content-type": "application/json" }).end(
            JSON.stringify({
              message: {
                guid,
                content: { text: body.text },
                dateCreated: new Date().toISOString(),
                chatGuids: [body.chatGuid],
              },
            }),
          );
          return;
        }
        if (path === "/v1/messages:listRecent" || path === "/v1/messages:listByChat") {
          const chatGuid = url.searchParams.get("chatGuid");
          const pageSize = Number(url.searchParams.get("pageSize") ?? 100);
          const offset = Number(url.searchParams.get("pageToken") || 0);
          const rows = this.history
            .filter((m) => path === "/v1/messages:listRecent" || m.chatGuid === chatGuid)
            .sort((a, b) => b.at.getTime() - a.at.getTime());
          const page = rows.slice(offset, offset + pageSize);
          response.writeHead(200, { "content-type": "application/json" }).end(
            JSON.stringify({
              messages: page.map((m) => ({
                guid: m.guid,
                chatGuids: [m.chatGuid],
                isFromMe: m.isFromMe ?? false,
                dateCreated: m.at.toISOString(),
                sender: {
                  address: m.from,
                  service: `CHAT_SERVICE_TYPE_${(m.service ?? "iMessage") === "SMS" ? "SMS" : "IMESSAGE"}`,
                },
                ...(m.reaction
                  ? { reaction: { kind: "MESSAGE_REACTION_KIND_LIKE", emoji: "" } }
                  : {}),
                content: {
                  text: m.text,
                  attachments: m.attachmentMime
                    ? [{ guid: "att-1", fileName: "photo.heic", mimeType: m.attachmentMime }]
                    : [],
                },
              })),
              ...(offset + pageSize < rows.length
                ? { nextPageToken: String(offset + pageSize) }
                : {}),
            }),
          );
          return;
        }
        if (path === "/v1/chats:setTyping") {
          response.writeHead(200, { "content-type": "application/json" }).end("{}");
          return;
        }
        response.writeHead(404).end();
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  get address(): string {
    return this.baseUrl;
  }

  /** The Spectrum Cloud REST boundary: only the token request exists. */
  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const basic = Buffer.from(`${this.projectId}:${this.projectSecret}`).toString("base64");
    const headers = new Headers(init?.headers);
    if (url.pathname !== `/projects/${this.projectId}/imessage/tokens` || init?.method !== "POST") {
      throw new Error(`Photon emulator received unexpected request ${url.pathname}`);
    }
    if (headers.get("authorization") !== `Basic ${basic}`) {
      return Response.json({ succeed: false }, { status: 401 });
    }
    this.tokenRequests += 1;
    return Response.json({
      succeed: true,
      data: { type: "shared", token: "emulated-line-token", expiresIn: 3600 },
    });
  };

  /** Store a message the history routes will serve. */
  addMessage(input: PhotonEmulatorHistoryMessage): void {
    this.history.push({
      ...input,
      chatGuid: input.chatGuid ?? `any;-;${input.from}`,
      at: input.at ?? new Date(),
      guid: this.nextGuid("hist"),
    });
  }

  /** Next N sends fail with this HTTP status and no body. */
  failNextSends(count: number, status = 500): void {
    this.failures = { remaining: count, status };
  }

  /** A `messages` delivery signed the way Spectrum signs it. */
  buildInboundRequest(input: PhotonEmulatorMessage, secret = this.webhookSecret): Request {
    const space = input.space ?? {
      id: `any;-;${input.direction === "outbound" ? this.line : input.from}`,
      platform: "iMessage",
      type: "dm",
      phone: "shared",
    };
    const body = JSON.stringify({
      event: "messages",
      space,
      message: {
        id: input.id ?? this.nextGuid("spc-msg"),
        platform: "iMessage",
        direction: input.direction ?? "inbound",
        timestamp: new Date().toISOString(),
        ...(input.service ? { service: input.service } : {}),
        sender: { id: input.from, platform: "iMessage" },
        space,
        content: input.content ?? { type: "text", text: input.text },
      },
    });
    const timestamp = String(input.signedAtSec ?? Math.floor(Date.now() / 1000));
    const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
    return new Request("https://rakazo.test/api/v1/messaging/webhook/photon", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-spectrum-event": "messages",
        "x-spectrum-timestamp": timestamp,
        "x-spectrum-signature": signature,
        "x-spectrum-webhook-id": "00000000-0000-4000-8000-0000000000aa",
      },
      body,
    });
  }

  private nextGuid(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }
}

/** The production photon platform with only the network boundaries swapped. Start the emulator first. */
export function createEmulatedPhotonPlatform(
  emulator: PhotonEmulator,
  options: Partial<PhotonAdapterConfig> = {},
): MessagingPlatform {
  const adapter = new PhotonAdapter({
    projectId: emulator.projectId,
    projectSecret: emulator.projectSecret,
    webhookSecret: emulator.webhookSecret,
    fetch: emulator.fetch,
    address: emulator.address,
    ...options,
  });
  return {
    provider: "photon",
    capabilities: { direct: true, groups: false, typing: true },
    adapter,
    history: adapter,
    directThreadId: (address) => adapter.directThreadId(address),
    transport: photonTransport,
  };
}
