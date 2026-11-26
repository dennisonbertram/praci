import type { PrismaClient } from "@rakazo/db";

interface Scope {
  spaceId: string;
  userId: string;
}

/**
 * The lowercased subset of `addresses` that the user protects: marked important, or saved in
 * Contacts. `exactAddresses` are addresses the user chose by exact address for the action being
 * judged (skip inbox, a rule from that address); for those only an important mark protects, so a
 * Contacts entry never overrides the user's own explicit choice.
 */
export async function protectedSenders(
  prisma: Pick<PrismaClient, "inboxSenderFeedback" | "contact">,
  scope: Scope,
  addresses: string[],
  options: { exactAddresses?: ReadonlySet<string> } = {},
): Promise<Set<string>> {
  const wanted = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return new Set();
  const [marks, contacts] = await Promise.all([
    prisma.inboxSenderFeedback.findMany({
      where: { ...scope, mark: "important", senderAddress: { in: wanted } },
      select: { senderAddress: true },
    }),
    prisma.contact.findMany({
      where: { ...scope, email: { in: wanted, mode: "insensitive" } },
      select: { email: true },
    }),
  ]);
  const result = new Set(marks.map((m) => m.senderAddress.toLowerCase()));
  for (const c of contacts) {
    const email = c.email?.toLowerCase();
    if (email && !options.exactAddresses?.has(email)) result.add(email);
  }
  return result;
}

/**
 * True when any inbound sender in the conversation of the cached message `providerMessageId` (on
 * `connectionId`, when given) is protected. An archive acts on the whole thread, so every sender
 * counts, not only the newest. A message that is not cached means the senders are unknown, which
 * also answers true so the caller asks.
 */
export async function threadHasProtectedSender(
  prisma: Pick<PrismaClient, "cachedMailMessage" | "inboxSenderFeedback" | "contact">,
  scope: Scope,
  providerMessageId: string,
  connectionId?: string,
): Promise<boolean> {
  const row = await prisma.cachedMailMessage.findFirst({
    where: { ...scope, providerMessageId, ...(connectionId ? { connectionId } : {}) },
    select: { threadId: true, connectionId: true },
  });
  if (!row) return true;
  const messages = await prisma.cachedMailMessage.findMany({
    where: { ...scope, connectionId: row.connectionId, threadId: row.threadId, fromSelf: false },
    select: { fromAddress: true },
  });
  const senders = messages.map((m) => m.fromAddress).filter((a): a is string => Boolean(a));
  return (await protectedSenders(prisma, scope, senders)).size > 0;
}
