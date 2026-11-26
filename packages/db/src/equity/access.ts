import type { EquityAccessGroupKey, EquityAccessLevel } from "@rakazo/contracts";
import {
  EQUITY_ACCESS_GROUPS,
  EquityAccessGrantListInputSchema,
  EquityAccessGrantSetInputSchema,
  EquityAccessGroupSetInputSchema,
  EquityHealthFindingCreateInputSchema,
  EquityHealthFindingListInputSchema,
  EquityHealthFindingUpdateInputSchema,
  EquitySavedViewCreateInputSchema,
  EquitySavedViewListInputSchema,
  EquitySavedViewUpdateInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import { recordEquityAudit } from "./audit.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  contains,
  defined,
  ensureLedger,
  inTransaction,
  iso,
  lockEquityLedger,
  notFound,
  pageArgs,
  pageOf,
  scopeOf,
  withConflict,
} from "./ledger.js";

type SavedViewRow = Prisma.EquitySavedViewGetPayload<object>;
type AccessGroupRow = Prisma.EquityAccessGroupGetPayload<object>;
type AccessGrantRow = Prisma.EquityAccessGrantGetPayload<object>;
type HealthFindingRow = Prisma.EquityHealthFindingGetPayload<object>;

export const equityAccessGroupOf = (relationship: string | null): EquityAccessGroupKey => {
  if (relationship === "founder") return "founders";
  if (relationship === "investor" || relationship === "board_member") return "investors";
  if (
    relationship === "employee" ||
    relationship === "executive" ||
    relationship === "advisor" ||
    relationship === "officer" ||
    relationship === "international_employee"
  )
    return "employees";
  if (relationship?.startsWith("ex_")) return "former_employees";
  return "other";
};

/** The reference's recommended level per group, used until a group level is saved. */
export const DEFAULT_ACCESS_LEVEL: Record<EquityAccessGroupKey, EquityAccessLevel> = {
  founders: "full_detail",
  investors: "advanced",
  employees: "basic",
  former_employees: "basic",
  other: "basic",
};

const toSavedView = (row: SavedViewRow) => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  page: row.page as never,
  name: row.name,
  params: row.params,
});

const toAccessGroup = (
  key: EquityAccessGroupKey,
  row: AccessGroupRow | undefined,
  memberCount: number,
) => ({
  key,
  level: (row?.level ?? DEFAULT_ACCESS_LEVEL[key]) as EquityAccessLevel,
  memberCount,
  updatedAt: row ? iso(row.updatedAt) : null,
});

const toAccessGrant = (row: AccessGrantRow & { stakeholder: { name: string } }) => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  stakeholderId: row.stakeholderId,
  stakeholderName: row.stakeholder.name,
  level: row.level as EquityAccessLevel | null,
  requestedLevel: row.requestedLevel as EquityAccessLevel | null,
  requestedAt: row.requestedAt ? iso(row.requestedAt) : null,
});

const toHealthFinding = (row: HealthFindingRow) => ({
  id: row.id,
  check: row.check,
  tag: row.tag as never,
  severity: row.severity as never,
  status: row.status as never,
  fingerprint: row.fingerprint,
  rows: (Array.isArray(row.rows) ? row.rows : []) as Array<Record<string, unknown>>,
  detectedAt: iso(row.detectedAt),
  dismissedAt: row.dismissedAt ? iso(row.dismissedAt) : null,
  updatedAt: iso(row.updatedAt),
});

// ---- saved views ----

export async function listEquitySavedViews(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquitySavedViewListInputSchema>,
) {
  const input = EquitySavedViewListInputSchema.parse(raw);
  const where: Prisma.EquitySavedViewWhereInput = {
    ...scopeOf(actor),
    ...(input.page ? { page: input.page } : {}),
    ...(input.search ? { name: contains(input.search) } : {}),
  };
  // The contract uses `page` for the view's tab, so pagination is pageSize only.
  const paging = { page: 1, pageSize: input.pageSize ?? 25 };
  const sort = input.sort ?? { field: "name", dir: "asc" };
  const orderBy: Prisma.EquitySavedViewOrderByWithRelationInput[] = [
    { [sort.field]: sort.dir },
    { id: "asc" },
  ];
  const [rows, total] = await Promise.all([
    prisma.equitySavedView.findMany({ where, orderBy, ...pageArgs(paging) }),
    prisma.equitySavedView.count({ where }),
  ]);
  return pageOf(rows.map(toSavedView), total, paging);
}

export async function getEquitySavedView(prisma: EquityDb, actor: EquityScope, id: string) {
  const row = await prisma.equitySavedView.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Saved view");
  return toSavedView(row);
}

export async function createEquitySavedView(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquitySavedViewCreateInputSchema>,
) {
  const input = EquitySavedViewCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const row = await withConflict("A saved view with that name already exists on this page", () =>
      tx.equitySavedView.create({
        data: { ...scope, page: input.page, name: input.name, params: input.params },
      }),
    );
    return toSavedView(row);
  });
}

export async function updateEquitySavedView(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquitySavedViewUpdateInputSchema>,
) {
  const input = EquitySavedViewUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const existing = await prisma.equitySavedView.findFirst({
    where: { id: input.id, ...scope },
  });
  if (!existing) throw notFound("Saved view");
  const row = await withConflict("A saved view with that name already exists on this page", () =>
    prisma.equitySavedView.update({
      where: { id: existing.id },
      data: defined({ name: input.name, params: input.params }),
    }),
  );
  return toSavedView(row);
}

// ---- access groups ----

async function memberCounts(prisma: EquityDb, actor: EquityScope) {
  const counts: Record<EquityAccessGroupKey, number> = {
    founders: 0,
    investors: 0,
    employees: 0,
    former_employees: 0,
    other: 0,
  };
  const rows = await prisma.equityStakeholder.findMany({
    where: { ...scopeOf(actor), mergedIntoId: null },
    select: { relationship: true },
  });
  for (const row of rows) counts[equityAccessGroupOf(row.relationship)] += 1;
  return counts;
}

export async function listEquityAccessGroups(prisma: EquityDb, actor: EquityScope) {
  const scope = scopeOf(actor);
  const [rows, counts] = await Promise.all([
    prisma.equityAccessGroup.findMany({ where: scope }),
    memberCounts(prisma, scope),
  ]);
  const byKey = new Map(rows.map((row) => [row.key as EquityAccessGroupKey, row]));
  return EQUITY_ACCESS_GROUPS.map((key) => toAccessGroup(key, byKey.get(key), counts[key]));
}

export async function setEquityAccessGroup(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessGroupSetInputSchema>,
) {
  const input = EquityAccessGroupSetInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const previous = await tx.equityAccessGroup.findUnique({
      where: { spaceId_userId_key: { ...scope, key: input.key } },
      select: { level: true },
    });
    const row = await tx.equityAccessGroup.upsert({
      where: { spaceId_userId_key: { ...scope, key: input.key } },
      create: { ...scope, key: input.key, level: input.level },
      update: { level: input.level },
    });
    if (previous?.level !== row.level)
      await recordEquityAudit(tx, actor, {
        kind: "access.group_level",
        subjectType: "group",
        subjectId: input.key,
        before: { level: previous?.level ?? null },
        after: { level: row.level },
      });
    const counts = await memberCounts(tx, scope);
    return toAccessGroup(input.key, row, counts[input.key]);
  });
}

// ---- access grants ----

export async function listEquityAccessGrants(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessGrantListInputSchema>,
) {
  const input = EquityAccessGrantListInputSchema.parse(raw);
  const where: Prisma.EquityAccessGrantWhereInput = {
    ...scopeOf(actor),
    ...(input.requested ? { requestedLevel: { not: null } } : {}),
    ...(input.search ? { stakeholder: { name: contains(input.search) } } : {}),
  };
  const paging = { page: 1, pageSize: input.pageSize ?? 25 };
  const sort = input.sort ?? { field: "stakeholderName", dir: "asc" };
  const orderBy: Prisma.EquityAccessGrantOrderByWithRelationInput[] =
    sort.field === "stakeholderName"
      ? [{ stakeholder: { name: sort.dir } }, { id: "asc" }]
      : [{ updatedAt: sort.dir }, { id: "asc" }];
  const [rows, total] = await Promise.all([
    prisma.equityAccessGrant.findMany({
      where,
      orderBy,
      include: { stakeholder: { select: { name: true } } },
      ...pageArgs(paging),
    }),
    prisma.equityAccessGrant.count({ where }),
  ]);
  return pageOf(rows.map(toAccessGrant), total, paging);
}

export async function setEquityAccessGrant(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessGrantSetInputSchema>,
) {
  const input = EquityAccessGrantSetInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    await assertInLedger(tx, scope, "equityStakeholder", input.stakeholderId);
    const stakeholder = await tx.equityStakeholder.findFirst({
      where: { id: input.stakeholderId, ...scope },
      select: { name: true },
    });
    if (!stakeholder) throw notFound("Stakeholder");
    const previous = await tx.equityAccessGrant.findUnique({
      where: { stakeholderId_spaceId_userId: { ...scope, stakeholderId: input.stakeholderId } },
      select: { level: true },
    });
    const row = await tx.equityAccessGrant.upsert({
      where: { stakeholderId_spaceId_userId: { ...scope, stakeholderId: input.stakeholderId } },
      create: { ...scope, stakeholderId: input.stakeholderId, level: input.level },
      update: { level: input.level },
    });
    if (previous?.level !== row.level)
      await recordEquityAudit(tx, actor, {
        kind: "access.grant_level",
        subjectType: "stakeholder",
        subjectId: input.stakeholderId,
        before: { level: previous?.level ?? null },
        after: { level: row.level },
      });
    return toAccessGrant({ ...row, stakeholder });
  });
}

/** The stakeholder's override, else the level of their relationship's group. */
export async function effectiveEquityAccessLevel(
  prisma: EquityDb,
  actor: EquityScope,
  stakeholderId: string,
): Promise<EquityAccessLevel> {
  const scope = scopeOf(actor);
  const stakeholder = await prisma.equityStakeholder.findFirst({
    where: { id: stakeholderId, ...scope },
    select: { relationship: true, accessGrant: { select: { level: true } } },
  });
  if (!stakeholder) throw notFound("Stakeholder");
  if (stakeholder.accessGrant?.level) return stakeholder.accessGrant.level as EquityAccessLevel;
  const key = equityAccessGroupOf(stakeholder.relationship);
  const group = await prisma.equityAccessGroup.findUnique({
    where: { spaceId_userId_key: { ...scope, key } },
  });
  return (group?.level as EquityAccessLevel | undefined) ?? DEFAULT_ACCESS_LEVEL[key];
}

// ---- health findings ----

export async function listEquityHealthFindings(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityHealthFindingListInputSchema>,
) {
  const input = EquityHealthFindingListInputSchema.parse(raw);
  const where: Prisma.EquityHealthFindingWhereInput = {
    ...scopeOf(actor),
    ...(input.status?.length ? { status: { in: input.status } } : {}),
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.tag ? { tag: input.tag } : {}),
    ...(input.search ? { check: contains(input.search) } : {}),
  };
  const paging = { page: input.page ?? 1, pageSize: input.pageSize ?? 25 };
  const sort = input.sort ?? { field: "detectedAt", dir: "desc" };
  const orderBy: Prisma.EquityHealthFindingOrderByWithRelationInput[] = [
    { [sort.field]: sort.dir },
    { id: "asc" },
  ];
  const [rows, total] = await Promise.all([
    prisma.equityHealthFinding.findMany({ where, orderBy, ...pageArgs(paging) }),
    prisma.equityHealthFinding.count({ where }),
  ]);
  return pageOf(rows.map(toHealthFinding), total, paging);
}

export async function getEquityHealthFinding(prisma: EquityDb, actor: EquityScope, id: string) {
  const row = await prisma.equityHealthFinding.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Health finding");
  return toHealthFinding(row);
}

export async function createEquityHealthFinding(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityHealthFindingCreateInputSchema>,
) {
  const input = EquityHealthFindingCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const key = {
      ...scope,
      check: input.check,
      fingerprint: input.fingerprint,
    };
    const rows = (input.rows ?? []) as Prisma.InputJsonValue;
    const existing = await tx.equityHealthFinding.findUnique({
      where: { spaceId_userId_check_fingerprint: key },
    });
    if (!existing) {
      const row = await tx.equityHealthFinding.create({
        data: {
          ...key,
          tag: input.tag,
          severity: input.severity,
          rows,
        },
      });
      return toHealthFinding(row);
    }
    const row = await tx.equityHealthFinding.update({
      where: { id: existing.id },
      data: {
        tag: input.tag,
        severity: input.severity,
        rows,
        detectedAt: new Date(),
        // A dismissed finding stays dismissed; a resolved one is live again.
        ...(existing.status === "dismissed" ? {} : { status: "open", dismissedAt: null }),
      },
    });
    return toHealthFinding(row);
  });
}

export async function updateEquityHealthFinding(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityHealthFindingUpdateInputSchema>,
) {
  const input = EquityHealthFindingUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const existing = await prisma.equityHealthFinding.findFirst({
    where: { id: input.id, ...scope },
  });
  if (!existing) throw notFound("Health finding");
  const status = input.status;
  const row = await prisma.equityHealthFinding.update({
    where: { id: existing.id },
    data: {
      status,
      dismissedAt: status === "dismissed" ? (existing.dismissedAt ?? new Date()) : null,
    },
  });
  return toHealthFinding(row);
}
