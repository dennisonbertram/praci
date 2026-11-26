import { getConnInfo } from "@hono/node-server/conninfo";
import type { PrismaClient } from "@rakazo/db";
import type { Context, Hono } from "hono";

/** Registrations one address may make per window. Registration is open to anyone by design. */
export const REGISTER_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;
const REGISTER_PATH = "/api/auth/oauth2/register";

const isTrustedProxy = (address: string | undefined) => {
  if (!address) return false;
  const normalized = address.toLowerCase();
  const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  if (ipv4 === "::1" || ipv4 === "127.0.0.1" || ipv4.startsWith("127.")) return true;
  if (/^(10|192\.168)\./.test(ipv4)) return true;
  const secondOctet = /^172\.(\d{1,3})\./.exec(ipv4)?.[1];
  if (secondOctet !== undefined && Number(secondOctet) >= 16 && Number(secondOctet) <= 31) {
    return true;
  }
  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
};

/**
 * The address of the caller. Without a trusted-proxy setting, this trusts `X-Forwarded-For`
 * only from loopback or a private peer, where a proxy can share the private network (for example,
 * Caddy in compose). Public clients cannot have a private source address across the internet.
 * The proxy adds the address it saw at the end of the header, so anything the client wrote sits
 * before the last entry.
 */
export function clientIp(peer: string | undefined, forwardedFor: string | undefined) {
  const last = forwardedFor?.split(",").at(-1)?.trim();
  return (isTrustedProxy(peer) && last ? last : peer) || "unknown";
}

/**
 * Counts one registration against the address's fixed window and returns the seconds to wait
 * when it is over the limit. One INSERT ... ON CONFLICT per call, so Postgres serialises
 * concurrent API processes. Uses Better Auth's `rateLimit` table, with `lastRequest` as the
 * window start in epoch milliseconds.
 */
export async function takeRegisterSlot(
  prisma: PrismaClient,
  ip: string,
  now = new Date(),
): Promise<number | null> {
  const windowStart = BigInt(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const key = `mcp-register:${ip}`;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${crypto.randomUUID()}, ${key}, 1, ${windowStart})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rateLimit"."lastRequest" < ${windowStart} THEN 1 ELSE "rateLimit"."count" + 1 END,
      "lastRequest" = GREATEST("rateLimit"."lastRequest", ${windowStart})
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) > REGISTER_LIMIT
    ? Math.max(1, Math.ceil((Number(windowStart) + WINDOW_MS - now.getTime()) / 1000))
    : null;
}

const peerOf = (c: Context) => {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
};

/** Register before the Better Auth handler. */
export function mountRegisterLimit(app: Hono, prisma: PrismaClient) {
  app.post(REGISTER_PATH, async (c, next) => {
    const retryAfter = await takeRegisterSlot(
      prisma,
      clientIp(peerOf(c), c.req.header("x-forwarded-for")),
    );
    if (retryAfter === null) return next();
    return c.json({ error: "too_many_requests" }, 429, { "retry-after": String(retryAfter) });
  });
}
