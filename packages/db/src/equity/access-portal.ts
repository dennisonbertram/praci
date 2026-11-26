import type { EquityAccessLevel, EquityAccessView } from "@rakazo/contracts";
import { EquityPortalProfileProposalSchema } from "@rakazo/contracts";
import type { Prisma } from "../client.js";
import type { PortalPrincipal } from "../investor-portal.js";
import { runAsTenant } from "../row-security.js";
import { requestEquityAccess } from "./access-holders.js";
import { equityHolderView } from "./access-view.js";
import type { EquityDb } from "./ledger.js";
import {
  EquityInputError,
  inTransaction,
  lockEquityLedger,
  lockEquityStakeholders,
} from "./ledger.js";

/**
 * The investor portal's cap table: the session's own contact, its linked stakeholder in the same
 * ledger, and only what that stakeholder's level allows. The scope comes from the session, never
 * from the request, so a holder cannot name another holder or space.
 */
async function portalStakeholder(prisma: EquityDb, principal: PortalPrincipal) {
  const scope = { spaceId: principal.spaceId, userId: principal.userId };
  const contact = await prisma.contact.findFirst({
    where: { id: principal.contactId, ...scope, kind: "investor", portalBlockedAt: null },
    select: { id: true },
  });
  if (!contact) return { scope, stakeholder: null, active: false };
  const stakeholder = await prisma.equityStakeholder.findFirst({
    where: { ...scope, contactId: contact.id, mergedIntoId: null },
    select: { id: true },
  });
  return { scope, stakeholder, active: true };
}

/** Null when the portal contact may no longer use the portal. */
export function portalHoldings(
  prisma: EquityDb,
  principal: PortalPrincipal,
): Promise<EquityAccessView | null> {
  return runAsTenant(principal, async () => {
    const { scope, stakeholder, active } = await portalStakeholder(prisma, principal);
    if (!active) return null;
    if (!stakeholder) return { level: "none" as const };
    return equityHolderView(prisma, scope, stakeholder.id);
  });
}

/** The holder asks for a higher level; the company approves or denies it on the Access tab. */
export function portalRequestAccess(
  prisma: EquityDb,
  principal: PortalPrincipal,
  level: EquityAccessLevel,
): Promise<boolean> {
  return runAsTenant(principal, async () => {
    const { scope, stakeholder } = await portalStakeholder(prisma, principal);
    if (!stakeholder) return false;
    try {
      await requestEquityAccess(prisma, scope, { stakeholderId: stakeholder.id, level });
      return true;
    } catch (error) {
      if (error instanceof EquityInputError) return false;
      throw error;
    }
  });
}

/**
 * The holder proposes changes to their own name, email or address. It lands in the stakeholders
 * area's change review queue as a pending profile change from the portal; nothing on the record
 * changes until the company accepts it. A second proposal supersedes (rejects) the pending one.
 */
export async function portalProposeProfileChange(
  prisma: EquityDb,
  principal: PortalPrincipal,
  raw: unknown,
): Promise<boolean> {
  const proposed = EquityPortalProfileProposalSchema.parse(raw);
  return runAsTenant(principal, async () => {
    if (!(await portalStakeholder(prisma, principal)).stakeholder) return false;
    // A new proposal supersedes the pending one instead of editing it, so what the company
    // reviewed can never change under its pointer.
    return inTransaction(prisma, async (tx) => {
      // Ledger first, then the holder row (the order a reviewer's accept and a merge use, so none
      // of them can deadlock). The holder is read again under the lock: it may have been merged
      // meanwhile. Two proposals from one holder queue here; a partial unique index backs this up.
      await lockEquityLedger(tx, principal);
      const { scope, stakeholder } = await portalStakeholder(tx, principal);
      if (!stakeholder) return false;
      await lockEquityStakeholders(tx, scope, [stakeholder.id]);
      await tx.equityStakeholderChange.updateMany({
        where: {
          ...scope,
          stakeholderId: stakeholder.id,
          kind: "profile",
          source: "portal",
          status: "pending",
        },
        data: { status: "rejected", resolvedAt: new Date() },
      });
      await tx.equityStakeholderChange.create({
        data: {
          ...scope,
          proposed: proposed as Prisma.InputJsonValue,
          kind: "profile",
          source: "portal",
          stakeholderId: stakeholder.id,
          status: "pending",
        },
      });
      return true;
    });
  });
}
