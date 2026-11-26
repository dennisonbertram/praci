import type { EquityAccessHolder, EquityAccessLevel } from "@rakazo/contracts";
import {
  EQUITY_ACCESS_LEVELS,
  EquityAccessContactLinkInputSchema,
  EquityAccessHolderListInputSchema,
  EquityAccessLevelBulkSetInputSchema,
  EquityAccessRequestInputSchema,
  EquityAccessRequestResolveInputSchema,
} from "@rakazo/contracts";
import { isOutstandingCertificate, percentOf } from "@rakazo/core/equity";
import type * as z from "zod";
import { DEFAULT_ACCESS_LEVEL, equityAccessGroupOf } from "./access.js";
import { recordEquityAudit } from "./audit.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import { EquityInputError, ensureLedger, inTransaction, iso, notFound, scopeOf } from "./ledger.js";

/** Higher index, more access. */
const rank = (level: EquityAccessLevel) =>
  EQUITY_ACCESS_LEVELS.length - EQUITY_ACCESS_LEVELS.indexOf(level);

/** Every holder row of the caller's ledger, computed in one scoped read. */
async function loadHolders(prisma: EquityDb, scope: EquityScope): Promise<EquityAccessHolder[]> {
  const [stakeholders, groups, certificates, grants, warrants, convertibles] = await Promise.all([
    prisma.equityStakeholder.findMany({
      where: { ...scope, mergedIntoId: null },
      include: { accessGrant: true, contact: { select: { portalLastSeenAt: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.equityAccessGroup.findMany({ where: scope }),
    prisma.equityCertificate.findMany({
      where: scope,
      select: {
        stakeholderId: true,
        status: true,
        quantity: true,
        shareClassId: true,
        shareClass: { select: { prefix: true } },
      },
    }),
    prisma.equityOptionGrant.findMany({
      where: { ...scope, status: "outstanding" },
      select: {
        stakeholderId: true,
        quantity: true,
        exercisedQuantity: true,
        canceledQuantity: true,
      },
    }),
    prisma.equityWarrant.findMany({
      where: { ...scope, status: "outstanding", quantity: { gt: 0n } },
      select: { stakeholderId: true },
    }),
    prisma.equityConvertible.findMany({
      where: { ...scope, status: "outstanding" },
      select: { stakeholderId: true },
    }),
  ]);
  const groupLevel = new Map(groups.map((row) => [row.key, row.level as EquityAccessLevel]));

  const shares = new Map<string, bigint>();
  const classes = new Map<string, Set<string>>();
  const holding = new Set<string>();
  let total = 0n;
  for (const row of certificates) {
    if (!isOutstandingCertificate(row.status) || row.quantity <= 0n) continue;
    shares.set(row.stakeholderId, (shares.get(row.stakeholderId) ?? 0n) + row.quantity);
    total += row.quantity;
    const set = classes.get(row.stakeholderId) ?? new Set();
    set.add(row.shareClass.prefix);
    classes.set(row.stakeholderId, set);
    holding.add(row.stakeholderId);
  }
  for (const row of grants)
    if (row.quantity - row.exercisedQuantity - row.canceledQuantity > 0n)
      holding.add(row.stakeholderId);
  for (const row of warrants) holding.add(row.stakeholderId);
  for (const row of convertibles) holding.add(row.stakeholderId);

  return stakeholders.map((row) => {
    const group = equityAccessGroupOf(row.relationship);
    const base = groupLevel.get(group) ?? DEFAULT_ACCESS_LEVEL[group];
    const override = (row.accessGrant?.level as EquityAccessLevel | null | undefined) ?? null;
    const lastSeen = row.contact?.portalLastSeenAt;
    return {
      stakeholderId: row.id,
      name: row.name,
      relationship: row.relationship,
      group,
      email: row.portfolioEmail ?? row.contactEmail,
      contactId: row.contactId,
      majorInvestor: row.majorInvestor,
      ownershipPercent: percentOf(shares.get(row.id) ?? 0n, total, 4),
      classCodes: [...(classes.get(row.id) ?? [])].sort(),
      groupLevel: base,
      overrideLevel: override,
      effectiveLevel: holding.has(row.id) ? (override ?? base) : "none",
      requestedLevel:
        (row.accessGrant?.requestedLevel as EquityAccessLevel | null | undefined) ?? null,
      requestedAt: row.accessGrant?.requestedAt ? iso(row.accessGrant.requestedAt) : null,
      lastSeenAt: lastSeen ? iso(lastSeen) : null,
    };
  });
}

export async function listEquityAccessHolders(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessHolderListInputSchema>,
) {
  const input = EquityAccessHolderListInputSchema.parse(raw);
  const scope = scopeOf(actor);
  let rows = await loadHolders(prisma, scope);
  const search = input.search?.toLowerCase();
  if (search)
    rows = rows.filter(
      (row) => row.name.toLowerCase().includes(search) || row.email?.toLowerCase().includes(search),
    );
  if (input.level?.length) rows = rows.filter((row) => input.level!.includes(row.effectiveLevel));
  if (input.group?.length) rows = rows.filter((row) => input.group!.includes(row.group));
  if (input.requested) rows = rows.filter((row) => row.requestedLevel != null);
  if (input.shareClassId) {
    const holders = await prisma.equityCertificate.findMany({
      where: { ...scope, shareClassId: input.shareClassId },
      select: { stakeholderId: true, status: true },
    });
    const ids = new Set(
      holders.filter((row) => isOutstandingCertificate(row.status)).map((row) => row.stakeholderId),
    );
    rows = rows.filter((row) => ids.has(row.stakeholderId));
  }
  const sort = input.sort ?? { field: "name", dir: "asc" };
  const key = (row: EquityAccessHolder): number | string =>
    sort.field === "ownership"
      ? Number(row.ownershipPercent)
      : sort.field === "effectiveLevel"
        ? rank(row.effectiveLevel)
        : sort.field === "lastSeenAt"
          ? (row.lastSeenAt ?? "")
          : row.name.toLowerCase();
  const sign = sort.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return (x < y ? -1 : x > y ? 1 : a.stakeholderId < b.stakeholderId ? -1 : 1) * sign;
  });
  const start = (input.page - 1) * input.pageSize;
  return {
    items: rows.slice(start, start + input.pageSize),
    total: rows.length,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** One override for many stakeholders, all or none. */
export async function setEquityAccessLevels(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessLevelBulkSetInputSchema>,
) {
  const input = EquityAccessLevelBulkSetInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const found = await tx.equityStakeholder.count({
      where: { ...scope, id: { in: input.stakeholderIds }, mergedIntoId: null },
    });
    if (found !== input.stakeholderIds.length)
      throw new EquityInputError("A stakeholder is not in this cap table");
    for (const stakeholderId of input.stakeholderIds) {
      const where = { stakeholderId_spaceId_userId: { ...scope, stakeholderId } };
      const previous = await tx.equityAccessGrant.findUnique({ where, select: { level: true } });
      await tx.equityAccessGrant.upsert({
        where,
        create: { ...scope, stakeholderId, level: input.level },
        update: { level: input.level },
      });
      if (previous?.level !== input.level)
        await recordEquityAudit(tx, actor, {
          kind: "access.grant_level",
          subjectType: "stakeholder",
          subjectId: stakeholderId,
          before: { level: previous?.level ?? null },
          after: { level: input.level },
        });
    }
    const ids = new Set(input.stakeholderIds);
    return (await loadHolders(tx, scope)).filter((row) => ids.has(row.stakeholderId));
  });
}

async function holderOf(prisma: EquityDb, scope: EquityScope, stakeholderId: string) {
  const row = (await loadHolders(prisma, scope)).find((r) => r.stakeholderId === stakeholderId);
  if (!row) throw notFound("Stakeholder");
  return row;
}

/** Approves (grants the requested level) or denies an open request; both close it. */
export async function resolveEquityAccessRequest(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessRequestResolveInputSchema>,
) {
  const input = EquityAccessRequestResolveInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const grant = await tx.equityAccessGrant.findFirst({
      where: { ...scope, stakeholderId: input.stakeholderId },
    });
    if (!grant) {
      await holderOf(tx, scope, input.stakeholderId);
      throw new EquityInputError("There is no open request");
    }
    if (!grant.requestedLevel) throw new EquityInputError("There is no open request");
    // Resolve exactly the level the owner reviewed. The conditional update also closes the race
    // with a holder re-requesting, or a second resolve, between the read and the write.
    const closed = await tx.equityAccessGrant.updateMany({
      where: { id: grant.id, requestedLevel: input.requestedLevel },
      data: {
        ...(input.approve ? { level: input.requestedLevel } : {}),
        requestedLevel: null,
        requestedAt: null,
      },
    });
    if (closed.count !== 1) throw new EquityInputError("The request changed; review it again");
    await recordEquityAudit(tx, actor, {
      kind: "access.resolve",
      subjectType: "stakeholder",
      subjectId: input.stakeholderId,
      before: { level: grant.level, requestedLevel: grant.requestedLevel },
      after: {
        level: input.approve ? input.requestedLevel : grant.level,
        requestedLevel: null,
        approved: input.approve,
      },
    });
    return holderOf(tx, scope, input.stakeholderId);
  });
}

/** Records a holder's request for more access than they have. */
export async function requestEquityAccess(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessRequestInputSchema>,
) {
  const input = EquityAccessRequestInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const holder = await holderOf(tx, scope, input.stakeholderId);
    if (rank(input.level) <= rank(holder.effectiveLevel))
      throw new EquityInputError("Ask for more than the current level");
    await tx.equityAccessGrant.upsert({
      where: { stakeholderId_spaceId_userId: { ...scope, stakeholderId: input.stakeholderId } },
      create: {
        ...scope,
        stakeholderId: input.stakeholderId,
        requestedLevel: input.level,
        requestedAt: new Date(),
      },
      update: { requestedLevel: input.level, requestedAt: new Date() },
    });
    await recordEquityAudit(tx, actor, {
      kind: "access.request",
      subjectType: "stakeholder",
      subjectId: input.stakeholderId,
      before: { level: holder.effectiveLevel },
      after: { requestedLevel: input.level },
    });
    return holderOf(tx, scope, input.stakeholderId);
  });
}

/**
 * Links a holder to one investor contact of the same space and user, or unlinks them. A contact
 * reaches at most one holder, so the portal never has to guess whose holdings to show.
 */
export async function linkEquityHolderContact(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessContactLinkInputSchema>,
) {
  const input = EquityAccessContactLinkInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const stakeholder = await tx.equityStakeholder.findFirst({
      where: { id: input.stakeholderId, ...scope, mergedIntoId: null },
      select: { id: true, contactId: true },
    });
    if (!stakeholder) throw notFound("Stakeholder");
    if (input.contactId) {
      const contact = await tx.contact.findFirst({
        where: { id: input.contactId, ...scope, kind: "investor" },
        select: { id: true },
      });
      if (!contact) throw new EquityInputError("Unknown investor contact");
      const taken = await tx.equityStakeholder.findFirst({
        where: { ...scope, contactId: contact.id, id: { not: stakeholder.id } },
        select: { name: true },
      });
      if (taken) throw new EquityInputError(`That contact is already linked to ${taken.name}`);
    }
    await tx.equityStakeholder.update({
      where: { id: stakeholder.id },
      data: { contactId: input.contactId },
    });
    await recordEquityAudit(tx, actor, {
      kind: input.contactId ? "contact.link" : "contact.unlink",
      subjectType: "stakeholder",
      subjectId: stakeholder.id,
      before: { contactId: stakeholder.contactId },
      after: { contactId: input.contactId },
    });
    return holderOf(tx, scope, stakeholder.id);
  });
}
