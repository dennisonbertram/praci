import type { PrismaClient } from "./client.js";

const PUSH = "push";

type Db = Pick<PrismaClient, "notificationEndpoint" | "$transaction">;
type Reader = Pick<PrismaClient, "notificationEndpoint">;

/** Registration found that its session was already gone. */
export class PushSessionEndedError extends Error {
  constructor() {
    super("Push session ended");
    this.name = "PushSessionEndedError";
  }
}

export type PushEndpoint = { id: string; address: string; sessionId: string | null };

/**
 * Saves a device's Expo push token for a user. The token identifies the device, so saving it
 * again only refreshes its session. A token belongs to one account: saving it removes it from
 * every other user, so a handed-over device stops receiving the previous account's pushes. A new
 * token from the same session replaces that session's old one (the device's token rotated).
 */
export async function savePushToken(
  prisma: Db,
  userId: string,
  token: string,
  sessionId?: string,
  options?: { sessionActive?: () => Promise<boolean> },
): Promise<void> {
  const address = token.trim();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`push-token:${address}`}, 0))`;
    if (options?.sessionActive && !(await options.sessionActive())) {
      throw new PushSessionEndedError();
    }
    await tx.notificationEndpoint.upsert({
      where: { userId_channel_deviceId: { userId, channel: PUSH, deviceId: address } },
      create: { userId, channel: PUSH, address, deviceId: address, sessionId: sessionId ?? null },
      update: { address, sessionId: sessionId ?? null },
    });
    await tx.notificationEndpoint.deleteMany({
      where: {
        channel: PUSH,
        OR: [
          { address, userId: { not: userId } },
          ...(sessionId ? [{ userId, sessionId, deviceId: { not: address } }] : []),
        ],
      },
    });
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
  prisma: Reader,
  userId: string,
  sessionId?: string,
): Promise<void> {
  await prisma.notificationEndpoint.deleteMany({
    where: { userId, channel: PUSH, ...(sessionId ? { sessionId } : {}) },
  });
}

/**
 * Ends the token registered by a session that is gone, or hands it to the session that replaces
 * it. Only that session's token is touched, so another device keeps its own.
 */
export async function endSessionPushTokens(
  prisma: Reader,
  userId: string,
  sessionId: string,
  nextSessionId?: string,
): Promise<void> {
  const where = { userId, channel: PUSH, sessionId };
  if (nextSessionId) {
    await prisma.notificationEndpoint.updateMany({ where, data: { sessionId: nextSessionId } });
  } else {
    await prisma.notificationEndpoint.deleteMany({ where });
  }
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
