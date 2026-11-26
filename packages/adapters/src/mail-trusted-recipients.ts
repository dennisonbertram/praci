import type { PrismaClient } from "@rakazo/db";

type Scope = { spaceId: string; userId: string };

/**
 * Of these addresses, the ones the owner trusts as recipients: an address the owner mailed by
 * hand (a sent message in their synced mail that no agent send produced), the owner's sign-in
 * address and `ownAddresses` (their mail accounts). An address that only ever wrote to the owner,
 * or was only on a thread, is not trusted: anyone can email first. Agent sends (`agent:` and
 * `approval_` compose records) never make an address trusted. Only as complete as the mail sync,
 * so a hand-sent message not yet synced reads as untrusted, the cautious way to be wrong.
 */
export async function ownerTrustedRecipients(
  prisma: Pick<PrismaClient, "$queryRaw">,
  scope: Scope,
  addresses: readonly string[],
  ownAddresses: readonly string[] = [],
): Promise<Set<string>> {
  const wanted = [...new Set(addresses.map((address) => address.trim().toLowerCase()))].filter(
    Boolean,
  );
  if (wanted.length === 0) return new Set();
  const own = new Set(ownAddresses.map((address) => address.trim().toLowerCase()));
  const found = await prisma.$queryRaw<{ address: string }[]>`
    SELECT lower(u.email) AS address
    FROM "user" u
    WHERE u.id = ${scope.userId} AND lower(u.email) = ANY(${wanted}::text[])
    UNION
    SELECT lower(x) AS address
    FROM mail_messages m
    CROSS JOIN LATERAL unnest(m."toAddresses" || m."ccAddresses") AS x
    WHERE m."spaceId" = ${scope.spaceId} AND m."userId" = ${scope.userId}
      AND m."fromSelf"
      AND lower(x) = ANY(${wanted}::text[])
      AND NOT EXISTS (
        SELECT 1 FROM compose_sends c
        WHERE c."spaceId" = m."spaceId" AND c."userId" = m."userId"
          AND c."connectionId" = m."connectionId"
          AND c."providerMessageId" = m."providerMessageId"
          AND (c."clientId" LIKE 'agent:%' OR c."clientId" LIKE 'approval\\_%')
      )`;
  return new Set([
    ...wanted.filter((address) => own.has(address)),
    ...found.map((row) => row.address),
  ]);
}
