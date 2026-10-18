import { triageStatus } from "@rakazo/adapters";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";

type Deps = Parameters<typeof triageStatus>[0];

/**
 * E2E only: records the AI data sharing consent the Inbox agent's mail tools need, for the model the
 * Inbox would use. The scripted runtime lists no recipients in `aiConsent/status`, so the Inbox
 * banner's Allow cannot grant it there. This writes the same row `allowAiConsent` writes, for the
 * recipient `triageStatus` resolves, so the real gate then passes. Returns how many rows it wrote.
 */
export async function grantInboxAiConsent(deps: Deps, userId: string): Promise<number> {
  const members = await deps.prisma.spaceMember.findMany({
    where: { userId },
    select: { spaceId: true },
  });
  let granted = 0;
  for (const { spaceId } of members) {
    const status = await triageStatus(deps, { userId, spaceId });
    if (status.blocked?.reason !== "needs_consent") continue;
    const recipientKey = status.blocked.recipient.key;
    await deps.prisma.aiDataConsent.upsert({
      where: { userId_spaceId_recipientKey: { userId, spaceId, recipientKey } },
      create: { userId, spaceId, recipientKey, version: AI_DISCLOSURE_VERSION },
      update: { version: AI_DISCLOSURE_VERSION, grantedAt: new Date() },
    });
    granted += 1;
  }
  return granted;
}
