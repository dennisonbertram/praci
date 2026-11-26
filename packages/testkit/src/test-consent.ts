import { aiRecipient } from "@rakazo/adapters";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

/** Grants one synthetic test owner consent for the exact model recipient used by a fixture. */
export async function grantTestModelConsent(
  prisma: PrismaClient,
  owner: { userId: string; spaceId: string },
  model: { provider: string; modelId: string; baseUrl?: string },
) {
  const recipient = aiRecipient({ ...model, use: "model" });
  if (!recipient) return;

  const where = { userId: owner.userId, spaceId: owner.spaceId, recipientKey: recipient.key };
  await prisma.aiDataConsent.upsert({
    where: { userId_spaceId_recipientKey: where },
    create: { ...where, version: AI_DISCLOSURE_VERSION },
    update: { version: AI_DISCLOSURE_VERSION },
  });
}
