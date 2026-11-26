import { createPrivateKey, sign } from "node:crypto";
import type { ClientHttp2Session } from "node:http2";
import { connect } from "node:http2";
import type {
  AdapterContext,
  NotificationChannel,
  NotificationEndpointRef,
  NotificationEnvelope,
  NotificationSendResult,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { listPushEndpoints } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { combineSignals } from "./connector-safety.js";
import type { PushSessionExpiresAt } from "./expo-push.js";
import { ExpoPushProvider, expoNotificationData } from "./expo-push.js";

const APNS_TIMEOUT_MS = 15_000;
/** Apple rejects tokens older than 60 minutes and throttles refreshes faster than 20. */
const JWT_TTL_MS = 50 * 60 * 1000;
const MAX_RESPONSE_BYTES = 16 * 1024;

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  /** PEM text of the .p8 key. */
  privateKey: string;
  bundleId: string;
  sandbox: boolean;
};

/** Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID, APNS_SANDBOX. Off unless all but the last are set. */
export function apnsConfigFromEnv(env: Record<string, string | undefined>): ApnsConfig | undefined {
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  const privateKey = env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const bundleId = env.APNS_BUNDLE_ID?.trim();
  if (!keyId || !teamId || !privateKey || !bundleId) return undefined;
  return {
    keyId,
    teamId,
    privateKey,
    bundleId,
    sandbox: /^(1|true|yes)$/i.test(env.APNS_SANDBOX?.trim() ?? ""),
  };
}

export type ApnsRequest = {
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
};
export type ApnsResponse = { status: number; body: string };
export type ApnsTransport = (request: ApnsRequest) => Promise<ApnsResponse>;

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** ES256 provider token. The JWS signature is the raw r||s form (ieee-p1363), not DER. */
export function apnsJwt(config: ApnsConfig, issuedAtSeconds: number): string {
  const input = `${b64url(JSON.stringify({ alg: "ES256", kid: config.keyId }))}.${b64url(
    JSON.stringify({ iss: config.teamId, iat: issuedAtSeconds }),
  )}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${input}.${b64url(signature)}`;
}

const CONNECT_TIMEOUT_MS = 10_000;

/**
 * One HTTP/2 session per host, reused until it closes, errors, receives GOAWAY, or a request on it
 * times out or is cancelled (the next request then reconnects). `connectFn` is for tests.
 */
export function createHttp2Transport(
  connectFn: typeof connect = connect,
  connectTimeoutMs = CONNECT_TIMEOUT_MS,
): ApnsTransport {
  const sessions = new Map<string, ClientHttp2Session>();
  const sessionFor = (host: string) => {
    const existing = sessions.get(host);
    if (existing && !existing.closed && !existing.destroyed) return existing;
    const session = connectFn(`https://${host}`);
    const drop = () => {
      clearTimeout(timer);
      if (sessions.get(host) === session) sessions.delete(host);
      if (!session.destroyed) session.destroy();
    };
    const timer = setTimeout(drop, connectTimeoutMs);
    session.once("connect", () => clearTimeout(timer));
    // One handler for the session's life: request listeners never attach to the session.
    session.on("close", drop);
    session.on("error", drop);
    session.on("goaway", drop);
    session.unref();
    sessions.set(host, session);
    return session;
  };
  return (request) =>
    new Promise<ApnsResponse>((resolve, reject) => {
      if (request.signal.aborted) return reject(new Error("APNs request aborted."));
      let settled = false;
      let status = 0;
      const chunks: Buffer[] = [];
      let size = 0;
      const session = sessionFor(request.host);
      const stream = session.request({
        ":method": "POST",
        ":path": request.path,
        ...request.headers,
      });
      const onAbort = () => {
        done(() => reject(new Error("APNs request aborted.")));
        stream.destroy();
        // A stalled connection must not serve the retry.
        session.destroy();
      };
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        request.signal.removeEventListener("abort", onAbort);
        fn();
      };
      // Before anything that can return early or fail.
      stream.on("error", (error) => done(() => reject(error)));
      stream.on("close", () =>
        done(() => reject(new Error("APNs stream closed before a response."))),
      );
      request.signal.addEventListener("abort", onAbort, { once: true });
      stream.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
      });
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_RESPONSE_BYTES) chunks.push(chunk);
      });
      stream.on("end", () =>
        done(() => resolve({ status, body: Buffer.concat(chunks).toString("utf8") })),
      );
      stream.end(request.body);
    });
}

/** Reasons Apple gives when a device token will never work again. */
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

function reasonOf(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { reason?: unknown };
    return typeof parsed.reason === "string" ? parsed.reason : undefined;
  } catch {
    return undefined;
  }
}

/** Sends alerts to iPhones directly through APNs. Reached only for endpoints with platform "apns". */
export class ApnsPushProvider implements NotificationChannel {
  readonly channel = "push";
  private jwt?: { token: string; issuedAt: number };
  private readonly transport: ApnsTransport;
  private readonly now: () => number;

  constructor(
    private readonly prisma: Pick<PrismaClient, "notificationEndpoint">,
    private readonly config: ApnsConfig,
    options: {
      sessionExpiresAt?: PushSessionExpiresAt;
      transport?: ApnsTransport;
      now?: () => number;
    } = {},
  ) {
    this.sessionExpiresAt = options.sessionExpiresAt;
    this.transport = options.transport ?? createHttp2Transport();
    this.now = options.now ?? Date.now;
  }

  private readonly sessionExpiresAt?: PushSessionExpiresAt;

  describe() {
    return {
      id: "apns-push",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { push: true, email: false },
    };
  }

  private token(): string {
    const now = this.now();
    if (!this.jwt || now - this.jwt.issuedAt >= JWT_TTL_MS) {
      this.jwt = { token: apnsJwt(this.config, Math.floor(now / 1000)), issuedAt: now };
    }
    return this.jwt.token;
  }

  async send(
    envelope: NotificationEnvelope,
    endpoint: NotificationEndpointRef,
    context: AdapterContext,
  ): Promise<NotificationSendResult> {
    const current = (await listPushEndpoints(this.prisma, context.userId)).find(
      (e) => e.id === endpoint.id && e.address === endpoint.address,
    );
    if (!current || current.sessionId !== endpoint.sessionId) return "endpointGone";
    if (current.sessionId) {
      const expiresAt = await this.sessionExpiresAt?.(current.sessionId);
      if (!expiresAt || expiresAt.getTime() <= Date.now()) return "endpointGone";
    }
    const signal = combineSignals(context.signal, AbortSignal.timeout(APNS_TIMEOUT_MS));
    // Another account may have claimed the token, or the session ended, during the lookup.
    const latest = (await listPushEndpoints(this.prisma, context.userId)).find(
      (e) => e.id === endpoint.id && e.address === endpoint.address,
    );
    if (!latest || latest.sessionId !== current.sessionId) return "endpointGone";
    const data = expoNotificationData(envelope, context.spaceId);
    const response = await this.transport({
      host: this.config.sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com",
      path: `/3/device/${endpoint.address}`,
      headers: {
        authorization: `bearer ${this.token()}`,
        "apns-topic": this.config.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-collapse-id": envelope.id.slice(0, 64),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: { title: envelope.title, body: envelope.body ?? "" },
          sound: "default",
          ...(envelope.threadId ? { "thread-id": envelope.threadId } : {}),
        },
        ...data,
      }),
      signal,
    });
    if (response.status === 200) return "sent";
    const reason = reasonOf(response.body);
    if (response.status === 410 || (reason && DEAD_TOKEN_REASONS.has(reason))) {
      return "endpointGone";
    }
    // The provider token was refused: mint a new one on the retry.
    if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken")
      this.jwt = undefined;
    // 429, 5xx and other refusals are retried by the outbox, as for Expo.
    const message = `apns push failed (${response.status}${reason ? ` ${reason}` : ""})`;
    getLogger().error(message);
    throw new Error(message);
  }
}

/**
 * The "push" channel: reads every push endpoint and sends each by its platform. APNs endpoints are
 * stored but not sent while the deployment has no APNs credentials (one warning).
 */
export class PushChannel implements NotificationChannel {
  readonly channel = "push";
  private warned = false;

  constructor(
    private readonly prisma: Pick<PrismaClient, "notificationEndpoint">,
    private readonly expo: ExpoPushProvider,
    private readonly apns?: ApnsPushProvider,
  ) {}

  describe() {
    return this.expo.describe();
  }

  async endpoints(scope: { userId: string; spaceId: string }): Promise<NotificationEndpointRef[]> {
    const rows = await this.prisma.notificationEndpoint.findMany({
      where: {
        userId: scope.userId,
        channel: "push",
        OR: [{ spaceId: null }, { spaceId: scope.spaceId }],
      },
      select: { id: true, address: true, sessionId: true, platform: true },
    });
    const usable = rows.filter((row) => row.platform !== "apns" || this.apns);
    if (usable.length < rows.length && !this.warned) {
      this.warned = true;
      getLogger().warn(
        "apns push is off: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY and APNS_BUNDLE_ID are not all set",
      );
    }
    return usable.map(({ id, address, sessionId }) => ({ id, address, sessionId }));
  }

  async send(
    envelope: NotificationEnvelope,
    endpoint: NotificationEndpointRef,
    context: AdapterContext,
  ): Promise<NotificationSendResult> {
    const row = await this.prisma.notificationEndpoint.findUnique({
      where: { id: endpoint.id },
      select: { platform: true },
    });
    if (!row) return "endpointGone";
    if (row.platform === "apns") {
      if (!this.apns) throw new Error("APNs credentials are not configured.");
      return this.apns.send(envelope, endpoint, context);
    }
    return this.expo.send(envelope, endpoint, context);
  }
}

export function createPushChannel(
  prisma: Pick<PrismaClient, "notificationEndpoint">,
  sessionExpiresAt: PushSessionExpiresAt,
  env: Record<string, string | undefined>,
): PushChannel {
  const config = apnsConfigFromEnv(env);
  return new PushChannel(
    prisma,
    new ExpoPushProvider(prisma, sessionExpiresAt),
    config ? new ApnsPushProvider(prisma, config, { sessionExpiresAt }) : undefined,
  );
}
