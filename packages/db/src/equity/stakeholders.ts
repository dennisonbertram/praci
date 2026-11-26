import type {
  EquityAddress,
  EquityCustomProperty,
  EquityDatedPropertyInput,
  EquityStakeholder,
  EquityStakeholderDetail,
  EquityStakeholderPage,
} from "@rakazo/contracts";
import {
  EquityCustomPropertyCreateInputSchema,
  EquityCustomPropertyUpdateInputSchema,
  EquityStakeholderCreateInputSchema,
  EquityStakeholderListInputSchema,
  EquityStakeholderUpdateInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import { recordEquityAudit } from "./audit.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  contains,
  defined,
  EquityConflictError,
  EquityInputError,
  ensureLedger,
  fromDate,
  fromDateOrNull,
  inTransaction,
  iso,
  lockEquityLedger,
  notFound,
  pageArgs,
  pageOf,
  scopeOf,
  toDate,
  toDateOrNull,
  today,
  withConflict,
} from "./ledger.js";
import { keyColumns, replayedId } from "./request-key.js";

type Row = Prisma.EquityStakeholderGetPayload<object>;
type PropertyRow = Prisma.EquityStakeholderPropertyGetPayload<object>;

const NULLABLE_SORT = new Set(["contactEmail", "relationship", "costCenter"]);
const ADDRESS_FIELDS = ["country", "street", "city", "state", "postalCode"] as const;

function completeness(addresses: EquityAddress[]): "complete" | "incomplete" | "none" {
  const first = addresses[0];
  if (!first || ADDRESS_FIELDS.every((field) => !first[field])) return "none";
  return ADDRESS_FIELDS.every((field) => first[field]) ? "complete" : "incomplete";
}

export function toStakeholder(row: Row): EquityStakeholder {
  const addresses = (Array.isArray(row.addresses) ? row.addresses : []) as EquityAddress[];
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    type: row.type as EquityStakeholder["type"],
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    contactEmail: row.contactEmail,
    portfolioEmail: row.portfolioEmail,
    portfolioEmailLocked: row.portfolioEmailLockedAt !== null,
    otherEmails: row.otherEmails,
    dateOfBirth: fromDateOrNull(row.dateOfBirth),
    taxId: row.taxId,
    employeeId: row.employeeId,
    payrollId: row.payrollId,
    addresses,
    addressCompleteness: completeness(addresses),
    customValues: (row.customValues ?? {}) as Record<string, string>,
    parentId: row.parentId,
    contactId: row.contactId,
    majorInvestor: row.majorInvestor,
    relationship: row.relationship as EquityStakeholder["relationship"],
    jobTitle: row.jobTitle,
    costCenter: row.costCenter,
    department: row.department,
    terminatedOn: fromDateOrNull(row.terminatedAt),
    mergedIntoId: row.mergedIntoId,
  };
}

const toProperty = (row: PropertyRow) => ({
  id: row.id,
  kind: row.kind as EquityDatedPropertyInput["kind"],
  effectiveDate: fromDate(row.effectiveDate),
  value: row.value,
});

/** The latest value of each kind effective on or before `asOf`. */
export function currentProperties(
  properties: Array<{ kind: string; effectiveDate: string; value: string }>,
  asOf = today(),
) {
  const latest = new Map<string, { effectiveDate: string; value: string }>();
  for (const property of properties) {
    if (property.effectiveDate > asOf) continue;
    const seen = latest.get(property.kind);
    if (!seen || property.effectiveDate >= seen.effectiveDate) latest.set(property.kind, property);
  }
  return {
    relationship: latest.get("relationship")?.value ?? null,
    jobTitle: latest.get("job_title")?.value ?? null,
    costCenter: latest.get("cost_center")?.value ?? null,
    department: latest.get("department")?.value ?? null,
  };
}

async function detail(prisma: EquityDb, actor: EquityScope, id: string) {
  const row = await prisma.equityStakeholder.findFirst({
    where: { id, ...scopeOf(actor) },
    include: { properties: { orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] } },
  });
  if (!row) throw notFound("Stakeholder");
  const { properties, ...rest } = row;
  return { ...toStakeholder(rest), properties: properties.map(toProperty) };
}

async function checkReferences(
  prisma: EquityDb,
  actor: EquityScope,
  input: { parentId?: string | null; contactId?: string | null; customValues?: object },
  self?: string,
) {
  if (input.parentId && input.parentId === self)
    throw new EquityInputError("A stakeholder cannot be its own parent");
  await assertInLedger(prisma, actor, "equityStakeholder", input.parentId);
  if (input.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, ...scopeOf(actor) },
      select: { id: true },
    });
    if (!contact) throw new EquityInputError("Unknown contact");
  }
  const keys = Object.keys(input.customValues ?? {});
  if (keys.length) {
    const known = await prisma.equityCustomProperty.count({
      where: { id: { in: keys }, ...scopeOf(actor) },
    });
    if (known !== keys.length) throw new EquityInputError("Unknown custom property");
  }
}

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

/** Ids of the caller's stakeholders whose vesting matches any of the asked states. */
async function vestingMatches(
  prisma: EquityDb,
  actor: EquityScope,
  asked: ("active" | "ending" | "ended" | "none")[],
): Promise<string[]> {
  const scope = scopeOf(actor);
  const schedule = {
    select: { startDate: true, totalMonths: true, stoppedOn: true },
  } as const;
  const holders = await prisma.equityStakeholder.findMany({
    where: scope,
    select: {
      id: true,
      optionGrants: { where: scope, select: { vestingSchedule: schedule } },
      certificates: { where: scope, select: { vestingSchedule: schedule } },
    },
  });
  const now = new Date(`${today()}T00:00:00.000Z`);
  const horizon = addMonths(now, 12);
  return holders
    .filter((holder) => {
      const ends = [...holder.optionGrants, ...holder.certificates]
        .map((security) => security.vestingSchedule)
        .filter((row) => row != null)
        .map((row) => row.stoppedOn ?? addMonths(row.startDate, row.totalMonths));
      const active = ends.filter((end) => end > now);
      const states = new Set<string>();
      if (!ends.length) states.add("none");
      else if (!active.length) states.add("ended");
      if (active.length) states.add("active");
      if (active.some((end) => end <= horizon)) states.add("ending");
      return asked.some((state) => states.has(state));
    })
    .map((holder) => holder.id);
}

/** has: at least one certificate, convertible or option grant; none: no holdings at all. */
function holdingsWhere(
  holdings: ("has" | "none")[] | undefined,
): Prisma.EquityStakeholderWhereInput {
  if (holdings?.length !== 1) return {};
  const none = {
    certificates: { none: {} },
    convertibles: { none: {} },
    optionGrants: { none: {} },
  } satisfies Prisma.EquityStakeholderWhereInput;
  return holdings[0] === "has" ? { NOT: none } : none;
}

export async function getEquityStakeholder(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityStakeholderDetail> {
  return detail(prisma, actor, id);
}

export async function listEquityStakeholders(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderListInputSchema>,
): Promise<EquityStakeholderPage> {
  const input = EquityStakeholderListInputSchema.parse(raw);
  const relationships = input.relationship?.filter((value) => value !== "none");
  const duplicates = input.duplicateEmployeeId
    ? (
        await prisma.equityStakeholder.groupBy({
          by: ["employeeId"],
          where: { ...scopeOf(actor), mergedIntoId: null, employeeId: { not: null } },
          having: { employeeId: { _count: { gt: 1 } } },
        })
      ).map((group) => group.employeeId as string)
    : undefined;
  const noRelationship = input.relationship?.includes("none");
  const where: Prisma.EquityStakeholderWhereInput = {
    ...scopeOf(actor),
    ...(input.includeMerged ? {} : { mergedIntoId: null }),
    ...(input.type ? { type: input.type } : {}),
    ...(input.relationship
      ? {
          OR: [
            ...(relationships?.length ? [{ relationship: { in: relationships } }] : []),
            ...(noRelationship ? [{ relationship: null }] : []),
          ],
        }
      : {}),
    ...(input.costCenter ? { costCenter: { in: input.costCenter } } : {}),
    ...holdingsWhere(input.holdings),
    ...(duplicates ? { employeeId: { in: duplicates } } : {}),
    ...(input.vesting ? { id: { in: await vestingMatches(prisma, actor, input.vesting) } } : {}),
    ...(input.createdFrom || input.createdTo
      ? {
          createdAt: {
            ...(input.createdFrom ? { gte: toDate(input.createdFrom) } : {}),
            ...(input.createdTo
              ? { lt: new Date(toDate(input.createdTo).getTime() + 86_400_000) }
              : {}),
          },
        }
      : {}),
    ...(input.search
      ? {
          AND: [
            {
              OR: [
                { name: contains(input.search) },
                { contactEmail: contains(input.search) },
                { portfolioEmail: contains(input.search) },
              ],
            },
          ],
        }
      : {}),
  };
  const sort = input.sort ?? { field: "name", dir: "asc" };
  const orderBy: Prisma.EquityStakeholderOrderByWithRelationInput[] = [
    NULLABLE_SORT.has(sort.field)
      ? { [sort.field]: { sort: sort.dir, nulls: "last" } }
      : { [sort.field]: sort.dir },
    { id: "asc" },
  ];
  // Address completeness and country are derived from JSON, so those filters run after the query.
  if (input.addressCompleteness || input.country) {
    const rows = await prisma.equityStakeholder.findMany({ where, orderBy });
    const matching = rows
      .map(toStakeholder)
      .filter(
        (row) =>
          (!input.addressCompleteness ||
            input.addressCompleteness.includes(row.addressCompleteness)) &&
          (!input.country || input.country.includes(row.addresses[0]?.country || "none")),
      );
    const { skip, take } = pageArgs(input);
    return pageOf(matching.slice(skip, skip + take), matching.length, input);
  }
  const [rows, total] = await Promise.all([
    prisma.equityStakeholder.findMany({ where, orderBy, ...pageArgs(input) }),
    prisma.equityStakeholder.count({ where }),
  ]);
  return pageOf(rows.map(toStakeholder), total, input);
}

export async function createEquityStakeholder(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderCreateInputSchema>,
): Promise<EquityStakeholderDetail> {
  const input = EquityStakeholderCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityStakeholder.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay) return replay;
    await checkReferences(tx, scope, input);
    const properties = input.properties ?? [];
    const row = await tx.equityStakeholder.create({
      data: {
        ...scope,
        type: input.type,
        name: input.name,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        contactEmail: input.contactEmail ?? null,
        portfolioEmail: input.portfolioEmail ?? null,
        otherEmails: input.otherEmails ?? [],
        dateOfBirth: toDateOrNull(input.dateOfBirth) ?? null,
        taxId: input.taxId ?? null,
        employeeId: input.employeeId ?? null,
        payrollId: input.payrollId ?? null,
        addresses: input.addresses ?? [],
        customValues: input.customValues ?? {},
        parentId: input.parentId ?? null,
        contactId: input.contactId ?? null,
        majorInvestor: input.majorInvestor ?? false,
        ...currentProperties(properties),
        ...keyColumns(input),
      },
      select: { id: true },
    });
    if (properties.length)
      await tx.equityStakeholderProperty.createMany({
        data: properties.map((property) => ({
          ...scope,
          stakeholderId: row.id,
          kind: property.kind,
          effectiveDate: toDate(property.effectiveDate),
          value: property.value,
        })),
      });
    return row.id;
  });
  return detail(prisma, scope, id);
}

/** Fields whose values are safe to keep in the history; every other change is recorded by name. */
const AUDITED_VALUES = new Set([
  "type",
  "name",
  "firstName",
  "lastName",
  "parentId",
  "contactId",
  "majorInvestor",
  "relationship",
  "jobTitle",
]);

/**
 * Records the fields an edit changed. The history cannot be erased per person, so personal
 * fields (dates of birth, emails, addresses, tax and payroll ids, custom values) are recorded
 * as "[changed]", never as values. Dated property edits are recorded by kind.
 */
async function auditStakeholderEdit(
  tx: EquityDb,
  actor: EquityScope,
  existing: Prisma.EquityStakeholderGetPayload<object>,
  updated: Prisma.EquityStakeholderGetPayload<object>,
  propertyKinds: string[],
) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const key of Object.keys(updated) as Array<keyof typeof updated>) {
    if (key === "updatedAt") continue;
    if (JSON.stringify(existing[key]) === JSON.stringify(updated[key])) continue;
    const keep = AUDITED_VALUES.has(key);
    before[key] = keep ? existing[key] : "[changed]";
    after[key] = keep ? updated[key] : "[changed]";
  }
  if (propertyKinds.length) after.propertyKinds = propertyKinds;
  if (Object.keys(after).length)
    await recordEquityAudit(tx, actor, {
      kind: "stakeholder.update",
      subjectType: "stakeholder",
      subjectId: updated.id,
      before,
      after,
    });
}

export async function updateEquityStakeholder(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderUpdateInputSchema>,
): Promise<EquityStakeholderDetail> {
  const { id, properties, addProperties, ...input } = EquityStakeholderUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    const existing = await tx.equityStakeholder.findFirst({ where: { id, ...scope } });
    if (!existing) throw notFound("Stakeholder");
    if (
      input.portfolioEmail !== undefined &&
      existing.portfolioEmailLockedAt &&
      input.portfolioEmail !== existing.portfolioEmail
    )
      throw new EquityConflictError("The portfolio email is locked once a security is accepted");
    await checkReferences(tx, scope, input, id);
    let current = {};
    if (properties || addProperties) {
      if (properties) {
        const kinds = [...new Set(properties.map((property) => property.kind))];
        await tx.equityStakeholderProperty.deleteMany({
          where: { stakeholderId: id, ...scope, kind: { in: kinds } },
        });
      }
      // An added entry replaces one of the same kind on the same date, so a file can be re-run.
      for (const property of addProperties ?? [])
        await tx.equityStakeholderProperty.deleteMany({
          where: {
            stakeholderId: id,
            ...scope,
            kind: property.kind,
            effectiveDate: toDate(property.effectiveDate),
          },
        });
      await tx.equityStakeholderProperty.createMany({
        data: [...(properties ?? []), ...(addProperties ?? [])].map((property) => ({
          ...scope,
          stakeholderId: id,
          kind: property.kind,
          effectiveDate: toDate(property.effectiveDate),
          value: property.value,
        })),
      });
      const all = await tx.equityStakeholderProperty.findMany({
        where: { stakeholderId: id, ...scope },
      });
      current = currentProperties(all.map(toProperty));
    }
    const updated = await tx.equityStakeholder.update({
      where: { id },
      data: {
        ...defined({
          type: input.type,
          name: input.name,
          firstName: input.firstName,
          lastName: input.lastName,
          contactEmail: input.contactEmail,
          portfolioEmail: input.portfolioEmail,
          otherEmails: input.otherEmails,
          dateOfBirth: toDateOrNull(input.dateOfBirth),
          taxId: input.taxId,
          employeeId: input.employeeId,
          payrollId: input.payrollId,
          addresses: input.addresses,
          customValues: input.customValues,
          parentId: input.parentId,
          contactId: input.contactId,
          majorInvestor: input.majorInvestor,
        }),
        ...current,
      },
    });
    await auditStakeholderEdit(tx, actor, existing, updated, [
      ...new Set([...(properties ?? []), ...(addProperties ?? [])].map((p) => p.kind)),
    ]);
  });
  return detail(prisma, scope, id);
}

// ---- custom property definitions ----

const toCustomProperty = (
  row: Prisma.EquityCustomPropertyGetPayload<object>,
): EquityCustomProperty => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  name: row.name,
  hrisField: row.hrisField,
});

export async function listEquityCustomProperties(prisma: EquityDb, actor: EquityScope) {
  const rows = await prisma.equityCustomProperty.findMany({
    where: scopeOf(actor),
    orderBy: { name: "asc" },
  });
  return rows.map(toCustomProperty);
}

export async function createEquityCustomProperty(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCustomPropertyCreateInputSchema>,
) {
  const input = EquityCustomPropertyCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const row = await withConflict("A custom property with this name exists", () =>
      tx.equityCustomProperty.create({
        data: { ...scope, name: input.name, hrisField: input.hrisField ?? null },
      }),
    );
    return toCustomProperty(row);
  });
}

export async function updateEquityCustomProperty(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCustomPropertyUpdateInputSchema>,
) {
  const { id, ...input } = EquityCustomPropertyUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const existing = await prisma.equityCustomProperty.findFirst({ where: { id, ...scope } });
  if (!existing) throw notFound("Custom property");
  const row = await withConflict("A custom property with this name exists", () =>
    prisma.equityCustomProperty.update({ where: { id }, data: defined(input) }),
  );
  return toCustomProperty(row);
}
