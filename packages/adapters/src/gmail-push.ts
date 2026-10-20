import type { JsonWebKey, KeyObject } from "node:crypto";
import { createPublicKey, verify } from "node:crypto";
import type { AdapterContext, JobPublisher, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { requestMailSync } from "./mail-sync-job.js";

/** Where Pub/Sub delivers Gmail push messages; the default token audience is this URL on the web origin. */
export const MAIL_PUSH_PATH = "/api/v1/mail/push";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const TOPIC_PATTERN = /^projects\/[^/]+\/topics\/[^/]+$/;
const CLOCK_SKEW_S = 30;
const CERTS_TTL_MS = 3_600_000;
const CERTS_RETRY_MS = 60_000;
const CERTS_TIMEOUT_MS = 5_000;
/** Renew a watch when less than this is left; the daily job and every sync both check. */
const RENEW_BEFORE_MS = 2 * 86_400_000;
const STOP_TIMEOUT_MS = 10_000;
const RENEWAL_PAGE = 100;
const MAX_WOKEN = 100;

/** The one deployment-level setting that turns Gmail push on. Absent by default: polling only. */
export interface GmailPushConfig {
  /** Pub/Sub topic Gmail publishes to: `projects/<project>/topics/<topic>`. */
  topic: string;
  /** Service account the push subscription signs its tokens as. */
  serviceAccount: string;
  /** Audience the push subscription puts in its tokens. */
  audience: string;
}

/**
 * Push is on only when both the topic and the service account are set: the audience alone is
 * forgeable, because any Google identity can mint a token for any audience.
 */
export function gmailPushConfigFromEnv(
  env: Record<string, string | undefined>,
  webOrigin: string,
): GmailPushConfig | undefined {
  const topic = env.GMAIL_PUSH_TOPIC?.trim();
  const serviceAccount = env.GMAIL_PUSH_SERVICE_ACCOUNT?.trim();
  if (!topic) return undefined;
  if (!TOPIC_PATTERN.test(topic) || !serviceAccount) {
    getLogger().warn("gmail push is off", {
      reason: !TOPIC_PATTERN.test(topic)
        ? "GMAIL_PUSH_TOPIC is not projects/<project>/topics/<topic>"
        : "GMAIL_PUSH_SERVICE_ACCOUNT is not set",
    });
    return undefined;
  }
  const audience = env.GMAIL_PUSH_AUDIENCE?.trim() || new URL(MAIL_PUSH_PATH, webOrigin).toString();
  return { topic, serviceAccount, audience };
}

/** Resolves a signing key by its `kid`; undefined when Google publishes none by that id. */
export type GoogleKeyResolver = (kid: string) => Promise<KeyObject | undefined>;

/**
 * Google's public signing keys. Cached in memory for an hour (they are public and re-derivable, not
 * durable state). An unknown `kid` refetches at most once a minute, so garbage tokens cannot make
 * this process hammer Google.
 */
export function createGoogleKeyResolver(
  deps: { fetchJwks?: () => Promise<unknown>; now?: () => number } = {},
): GoogleKeyResolver {
  const now = deps.now ?? Date.now;
  const fetchJwks =
    deps.fetchJwks ??
    (async () => {
      const response = await fetch(GOOGLE_CERTS_URL, {
        signal: AbortSignal.timeout(CERTS_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`certs ${response.status}`);
      return response.json();
    });
  let keys = new Map<string, KeyObject>();
  let fetchedAt = Number.NEGATIVE_INFINITY;
  let attemptedAt = Number.NEGATIVE_INFINITY;
  return async (kid) => {
    const known = keys.get(kid);
    if (known && now() - fetchedAt < CERTS_TTL_MS) return known;
    if (now() - attemptedAt < CERTS_RETRY_MS) return undefined;
    attemptedAt = now();
    try {
      const body = (await fetchJwks()) as { keys?: unknown };
      const next = new Map<string, KeyObject>();
      for (const jwk of Array.isArray(body?.keys) ? body.keys : []) {
        const entry = jwk as { kid?: unknown; kty?: unknown };
        if (typeof entry.kid !== "string" || entry.kty !== "RSA") continue;
        next.set(entry.kid, createPublicKey({ key: jwk as JsonWebKey, format: "jwk" }));
      }
      keys = next;
      fetchedAt = now();
    } catch (error) {
      getLogger().warn("google signing keys could not be fetched", {
        reason: error instanceof Error ? error.name : "error",
      });
    }
    return keys.get(kid);
  };
}

/**
 * Reads the mailbox address from a Pub/Sub push body (`message.data` is base64 JSON with
 * `emailAddress`). Every other field, the history id included, is ignored. Undefined when unreadable.
 */
export function parseGmailPushNotification(raw: string): string | undefined {
  try {
    const data = (JSON.parse(raw) as { message?: { data?: unknown } })?.message?.data;
    if (typeof data !== "string") return undefined;
    const address = (
      JSON.parse(Buffer.from(data, "base64").toString("utf8")) as { emailAddress?: unknown }
    )?.emailAddress;
    return typeof address === "string" && address ? address : undefined;
  } catch {
    return undefined;
  }
}

const decodeJson = (part: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Checks the OIDC token Pub/Sub attaches to a push request: RS256 signature against Google's keys,
 * Google as issuer, our audience, the configured service account as a verified email, and not
 * expired. Returns false for anything else and never throws. The token is never logged.
 */
export function createGmailPushVerifier(
  config: Pick<GmailPushConfig, "serviceAccount" | "audience">,
  deps: { keys?: GoogleKeyResolver; now?: () => number } = {},
): (authorization: string | null | undefined) => Promise<boolean> {
  const keys = deps.keys ?? createGoogleKeyResolver();
  const now = deps.now ?? Date.now;
  const serviceAccount = config.serviceAccount.toLowerCase();
  return async (authorization) => {
    try {
      const match = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(
        authorization ?? "",
      );
      if (!match) return false;
      const [, head, body, signature] = match as unknown as [string, string, string, string];
      const header = decodeJson(head);
      if (header?.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return false;
      const key = await keys(header.kid);
      if (!key) return false;
      const signed = verify(
        "RSA-SHA256",
        Buffer.from(`${head}.${body}`),
        key,
        Buffer.from(signature, "base64url"),
      );
      if (!signed) return false;

      const claims = decodeJson(body);
      if (!claims) return false;
      if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.has(claims.iss)) return false;
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audiences.includes(config.audience)) return false;
      if (typeof claims.exp !== "number" || now() / 1000 > claims.exp + CLOCK_SKEW_S) return false;
      if (typeof claims.email !== "string" || claims.email.toLowerCase() !== serviceAccount)
        return false;
      return claims.email_verified === true;
    } catch {
      return false;
    }
  };
}

type WatchDeps = { prisma: PrismaClient; mail: MailProvider; now?: () => Date };

const providerReason = (error: unknown) =>
  error instanceof MailProviderError ? error.kind : error instanceof Error ? error.name : "error";

/**
 * Starts or renews the account's Gmail watch and stores its address, expiry and history id on the
 * sync state. A watch with more than two days left is left alone unless `force` is set. Accounts
 * whose route cannot watch (Composio, Pipedream) and accounts without a known address are skipped.
 * Provider errors are logged and swallowed: polling covers a missing watch.
 */
export async function ensureMailWatch(
  deps: WatchDeps,
  push: GmailPushConfig,
  account: MailAccount,
  context: AdapterContext,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!deps.mail.watchChanges || !account.address) return;
  const address = account.address.toLowerCase();
  const now = (deps.now ?? (() => new Date()))();
  try {
    const state = await deps.prisma.mailSyncState.findFirst({
      where: {
        connectionId: account.id,
        connection: { spaceId: account.spaceId, userId: account.userId },
      },
      select: { watchAddress: true, watchExpiresAt: true },
    });
    if (
      !options.force &&
      state?.watchAddress === address &&
      state.watchExpiresAt &&
      state.watchExpiresAt.getTime() - now.getTime() > RENEW_BEFORE_MS
    )
      return;
    const watch = await deps.mail.watchChanges(account, { topic: push.topic }, context);
    if (!watch) return;
    const data = {
      watchAddress: address,
      watchExpiresAt: new Date(watch.expiresAt),
      watchHistoryId: watch.cursor,
    };
    await deps.prisma.mailSyncState.upsert({
      where: { connectionId: account.id },
      create: { connectionId: account.id, ...data },
      update: data,
    });
  } catch (error) {
    getLogger().warn("gmail watch failed", {
      connectionId: account.id,
      reason: providerReason(error),
    });
  }
}

/**
 * Stops the connection's Gmail watch, if it has one, and clears it from the sync state. Run before
 * the connection is revoked, while the login still works. Never throws: an unstopped watch lapses
 * within 7 days, and pushes for a revoked connection wake nothing.
 */
export async function stopMailWatch(
  deps: Pick<WatchDeps, "prisma" | "mail">,
  scope: { spaceId: string; userId: string },
  connectionId: string,
): Promise<void> {
  const { spaceId, userId } = scope;
  try {
    if (!deps.mail.stopWatch) return;
    const state = await deps.prisma.mailSyncState.findFirst({
      where: { connectionId, connection: { spaceId, userId } },
      select: { watchAddress: true },
    });
    if (!state?.watchAddress) return;
    // users.stop ends the watch for the whole mailbox, so leave it running while another connection watches this address.
    const others = await deps.prisma.mailSyncState.count({
      where: {
        watchAddress: state.watchAddress,
        watchExpiresAt: { gt: new Date() },
        connectionId: { not: connectionId },
        connection: { status: "connected" },
      },
    });
    const signal = AbortSignal.timeout(STOP_TIMEOUT_MS);
    const context: AdapterContext = {
      operationId: `mail.watch.stop:${connectionId}`,
      traceId: `mail.watch.stop:${connectionId}`,
      spaceId,
      userId,
      signal,
    };
    if (others === 0) {
      const account = (await deps.mail.listAccounts({ spaceId, userId }, context)).find(
        (a) => a.id === connectionId,
      );
      if (account) await deps.mail.stopWatch(account, context);
    }
    await deps.prisma.mailSyncState.updateMany({
      where: { connectionId, connection: { spaceId, userId } },
      data: { watchAddress: null, watchExpiresAt: null, watchHistoryId: null },
    });
  } catch (error) {
    getLogger().warn("gmail watch could not be stopped", {
      connectionId,
      reason: providerReason(error),
    });
  }
}

/**
 * Queues a sync for every connected native Google connection that has an unexpired watch on this
 * mailbox address, across all spaces and users, each in its own scope. The address comes from an
 * authenticated push message but is still only matched, never trusted for anything else.
 * Returns how many connections were woken; throws if any enqueue failed, so Pub/Sub delivers again.
 */
export async function wakeMailConnections(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  emailAddress: string,
): Promise<number> {
  const address = emailAddress.trim().toLowerCase();
  if (address.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(address)) return 0;
  const rows = await deps.prisma.$queryRaw<
    Array<{ connectionId: string; spaceId: string; userId: string }>
  >`
    SELECT c.id AS "connectionId", c."spaceId", c."userId"
    FROM mail_sync_states s JOIN connections c ON c.id = s."connectionId"
    WHERE s."watchAddress" = ${address}
      AND s."watchExpiresAt" > timezone('utc', now())
      AND c."connectorId" = 'google' AND c.status = 'connected'
    LIMIT ${MAX_WOKEN}`;
  const results = await Promise.allSettled(rows.map((row) => requestMailSync(deps, row, "wake")));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
  return rows.length;
}

/**
 * Daily job: renews the watch of every native Google mail connection. Does nothing without push
 * configured. One connection failing does not stop the others.
 */
export async function runMailWatchRenewal(deps: {
  prisma: PrismaClient;
  mail: MailProvider;
  now?: () => Date;
  push?: GmailPushConfig;
}): Promise<void> {
  const { push, prisma } = deps;
  if (!push) return;
  let after = "";
  for (;;) {
    const page = await prisma.connection.findMany({
      where: {
        connectorId: "google",
        status: "connected",
        provider: { equals: "gmail", mode: "insensitive" },
        id: { gt: after },
      },
      orderBy: { id: "asc" },
      take: RENEWAL_PAGE,
      select: { id: true, spaceId: true, userId: true },
    });
    if (page.length === 0) return;
    after = page.at(-1)?.id as string;
    const owners = new Map<string, { spaceId: string; userId: string; ids: Set<string> }>();
    for (const row of page) {
      const key = `${row.spaceId}:${row.userId}`;
      const owner = owners.get(key) ?? { spaceId: row.spaceId, userId: row.userId, ids: new Set() };
      owner.ids.add(row.id);
      owners.set(key, owner);
    }
    for (const { spaceId, userId, ids } of owners.values()) {
      const context: AdapterContext = {
        operationId: "mail.watch.renew",
        traceId: "mail.watch.renew",
        spaceId,
        userId,
        signal: AbortSignal.timeout(60_000),
      };
      try {
        const accounts = await deps.mail.listAccounts({ spaceId, userId }, context);
        for (const account of accounts)
          if (account.connectorId === "google" && ids.has(account.id))
            await ensureMailWatch(deps, push, account, context, { force: true });
      } catch (error) {
        getLogger().warn("gmail watch renewal failed for a user", {
          reason: providerReason(error),
        });
      }
    }
    if (page.length < RENEWAL_PAGE) return;
  }
}
