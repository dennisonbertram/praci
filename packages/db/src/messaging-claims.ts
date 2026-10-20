import type { PrismaClient } from "./client.js";

type ClaimDb = Pick<PrismaClient, "messagingInboundClaim">;
type CursorDb = Pick<PrismaClient, "messagingPollCursor">;

export function messagingInboundKey(provider: string, messageId: string): string {
  return `messaging:${provider}:${messageId}`;
}

/**
 * Durable insert-if-absent. True means this caller owns the message; false
 * means it was already handled (a replay, a second replica, a poll after the
 * webhook), and the caller must do nothing. The unique key makes this atomic
 * across processes.
 */
export async function claimInboundMessage(db: ClaimDb, key: string): Promise<boolean> {
  const { count } = await db.messagingInboundClaim.createMany({
    data: [{ key }],
    skipDuplicates: true,
  });
  return count === 1;
}

/** Give a claim back after a failed attempt so the provider's retry (or the next poll) can run it. */
export async function releaseInboundMessage(db: ClaimDb, key: string): Promise<void> {
  await db.messagingInboundClaim.deleteMany({ where: { key } });
}

/**
 * Take the poll lease for a provider. Returns the saved cursor (epoch ms, or
 * null before the first poll), or undefined when another replica holds the
 * lease, in which case this tick must not poll.
 */
export async function acquirePollLease(
  db: CursorDb,
  provider: string,
  leaseMs: number,
  now = new Date(),
): Promise<{ cursorMs: number | null } | undefined> {
  await db.messagingPollCursor.createMany({ data: [{ provider }], skipDuplicates: true });
  const { count } = await db.messagingPollCursor.updateMany({
    where: { provider, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseUntil: new Date(now.getTime() + leaseMs) },
  });
  if (count !== 1) return undefined;
  const row = await db.messagingPollCursor.findUniqueOrThrow({ where: { provider } });
  return { cursorMs: row.cursorMs === null ? null : Number(row.cursorMs) };
}

/** Move the cursor forward only; a slower replica can never move it back. */
export async function advancePollCursor(
  db: CursorDb,
  provider: string,
  cursorMs: number,
): Promise<void> {
  await db.messagingPollCursor.updateMany({
    where: { provider, OR: [{ cursorMs: null }, { cursorMs: { lt: BigInt(cursorMs) } }] },
    data: { cursorMs: BigInt(cursorMs) },
  });
}
