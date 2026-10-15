import type { SecretStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { persistPreparedSecret } from "./secret-persistence.js";

/** The user's Alchemy API key is one encrypted `secrets` row of this kind per space and user. */
const KIND = "finance-alchemy";
type Scope = { spaceId: string; userId: string };

/** Plaintext key, or null when none is stored. Only the sync and the validation use it. */
export async function loadAlchemyKey(
  prisma: PrismaClient,
  secrets: SecretStore,
  scope: Scope,
): Promise<string | null> {
  const row = await prisma.secret.findFirst({
    where: { kind: KIND, ...scope },
    orderBy: { createdAt: "desc" },
    select: { id: true, ciphertext: true },
  });
  return row ? secrets.load(row.ciphertext, row.id) : null;
}

export async function hasAlchemyKey(prisma: PrismaClient, scope: Scope): Promise<boolean> {
  return Boolean(
    await prisma.secret.findFirst({ where: { kind: KIND, ...scope }, select: { id: true } }),
  );
}

/** Replaces any stored key with this one. */
export async function storeAlchemyKey(
  prisma: PrismaClient,
  secrets: SecretStore,
  scope: Scope,
  apiKey: string,
): Promise<void> {
  const stored = await secrets.put(apiKey, {
    operationId: "finance.crypto.provider",
    traceId: "finance.crypto.provider",
    ...scope,
    botId: "mcp",
    signal: new AbortController().signal,
  });
  await persistPreparedSecret(prisma, secrets, stored, () =>
    prisma.$transaction(async (tx) => {
      await tx.secret.deleteMany({ where: { kind: KIND, ...scope } });
      await tx.secret.create({
        data: { id: stored.id, ...scope, kind: KIND, ciphertext: stored.ciphertext },
      });
    }),
  );
}

export async function removeAlchemyKey(prisma: PrismaClient, scope: Scope): Promise<void> {
  await prisma.secret.deleteMany({ where: { kind: KIND, ...scope } });
}
