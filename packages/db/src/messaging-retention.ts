import type { PrismaClient } from "./client.js";

/** Outbox rows and inbound claims are transport state; they keep no longer than a week. */
export const MESSAGING_RETENTION_MS = 7 * 24 * 60 * 60_000;
const DELETE_BATCH = 1000;

type Db = Pick<PrismaClient, "$executeRaw">;

/**
 * Deletes messaging outbox rows and inbound claims created more than 7 days ago, a batch at a
 * time so one run never holds a long lock. Thread messages are the user's chat history and are
 * not touched.
 */
export async function deleteExpiredMessagingTransport(
  prisma: Db,
  now = new Date(),
): Promise<{ outbound: number; claims: number }> {
  const cutoff = new Date(now.getTime() - MESSAGING_RETENTION_MS);
  let outbound = 0;
  let claims = 0;
  for (let n = DELETE_BATCH; n === DELETE_BATCH; outbound += n) {
    n = await prisma.$executeRaw`
      DELETE FROM "messaging_outbound" WHERE "id" IN (
        SELECT "id" FROM "messaging_outbound" WHERE "createdAt" < ${cutoff} LIMIT ${DELETE_BATCH})`;
  }
  for (let n = DELETE_BATCH; n === DELETE_BATCH; claims += n) {
    n = await prisma.$executeRaw`
      DELETE FROM "messaging_inbound_claims" WHERE "id" IN (
        SELECT "id" FROM "messaging_inbound_claims" WHERE "createdAt" < ${cutoff} LIMIT ${DELETE_BATCH})`;
  }
  return { outbound, claims };
}
