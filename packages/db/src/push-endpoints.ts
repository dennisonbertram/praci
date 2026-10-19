import type { PrismaClient } from "./client.js";

const PUSH = "push";

type Db = Pick<PrismaClient, "notificationEndpoint" | "$transaction">;
type Reader = Pick<PrismaClient, "notificationEndpoint">;

/**
 * Registration, rotation, sign-out and session replacement for one user take this lock first, so
 * they run one at a time. A token lock follows for cross-account handover; the order is always
 * user, then token, so two transactions cannot wait on each other.
 */
const lockUser = (tx: Pick<PrismaClient, "$executeRaw">, userId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`push-user:${userId}`}, 0))`;

/** Registration found that its session was already gone. */
export class PushSessionEndedError extends Error {
  constructor() {
    super("Push session ended");
    this.name = "PushSessionEndedError";
  }
}

export type PushEndpoint = { id: string; address: string; sessionId: string | null };

/**
 * Saves a device's Expo push token for a user. An address belongs to exactly one endpoint
 * (unique on channel and address), so saving a token another account holds moves it: the
 * previous account stops receiving pushes on that device. The same token saved again only
 * refreshes its session. Other tokens of the same session are kept (another device may share the
 * session); `replacesToken` names this user's previous token for this device, which is removed.
 */
export async function savePushToken(
  prisma: Db,
  userId: string,
  token: string,
  sessionId?: string,
  options?: { sessionActive?: () => Promise<boolean>; replacesToken?: string },
): Promise<void> {
  const address = token.trim();
  const replaces = options?.replacesToken?.trim();
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`push-token:${address}`}, 0))`;
    // Checked under the locks, in the transaction that writes, so sign-out cannot slip between.
    if (options?.sessionActive && !(await options.sessionActive())) {
      throw new PushSessionEndedError();
    }
    await tx.notificationEndpoint.upsert({
      where: { channel_address: { channel: PUSH, address } },
      create: { userId, channel: PUSH, address, deviceId: address, sessionId: sessionId ?? null },
      update: { userId, deviceId: address, sessionId: sessionId ?? null },
    });
    if (replaces && replaces !== address) {
      await tx.notificationEndpoint.deleteMany({
        where: { userId, channel: PUSH, address: replaces },
      });
    }
  });
}

/** The user's push endpoints. */
export async function listPushEndpoints(prisma: Reader, userId: string): Promise<PushEndpoint[]> {
  return prisma.notificationEndpoint.findMany({
    where: { userId, channel: PUSH },
    select: { id: true, address: true, sessionId: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Removes the push token the given session registered, or all of the user's when none is given. */
export async function deletePushTokens(
  prisma: Db,
  userId: string,
  sessionId?: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.notificationEndpoint.deleteMany({
      where: { userId, channel: PUSH, ...(sessionId ? { sessionId } : {}) },
    });
  });
}

/**
 * Ends the token registered by a session that is gone, or hands it to the session that replaces
 * it. Only that session's token is touched, so another device keeps its own.
 */
export async function endSessionPushTokens(
  prisma: Db,
  userId: string,
  sessionId: string,
  nextSessionId?: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const where = { userId, channel: PUSH, sessionId };
    if (nextSessionId) {
      await tx.notificationEndpoint.updateMany({ where, data: { sessionId: nextSessionId } });
    } else {
      await tx.notificationEndpoint.deleteMany({ where });
    }
  });
}

/** Removes one endpoint, only while it still has the session it was read with. */
export async function deletePushEndpoint(
  prisma: Reader,
  endpoint: { id: string; sessionId: string | null },
): Promise<void> {
  await prisma.notificationEndpoint.deleteMany({
    where: { id: endpoint.id, sessionId: endpoint.sessionId },
  });
}
