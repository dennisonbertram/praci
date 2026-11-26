import type {
  EquityAddress,
  EquityChangeImportInputSchema,
  EquityChangeImportResultSchema,
  EquityChangeProposed,
  EquityHrisPreferences,
  EquityHrisPreferencesSchema,
  EquityStakeholderChange,
  EquityStakeholderChangeCountsSchema,
  EquityStakeholderChangeListInputSchema,
  EquityStakeholderChangePageSchema,
  EquityStakeholderChangeResolveInputSchema,
  EquityStakeholderUpdateInput,
} from "@rakazo/contracts";
import {
  EquityStakeholderChangeListInputSchema as ChangeListInputSchema,
  EquityStakeholderChangeResolveInputSchema as ChangeResolveInputSchema,
  EquityChangeProposedSchema,
  EquityHrisPreferencesSchema as HrisPreferencesSchema,
  EquityChangeImportInputSchema as ImportInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  contains,
  EquityInputError,
  ensureLedger,
  fromDate,
  fromDateOrNull,
  inTransaction,
  iso,
  lockEquityLedger,
  lockEquityStakeholders,
  notFound,
  pageArgs,
  pageOf,
  scopeOf,
  toDateOrNull,
  today,
} from "./ledger.js";
import { createEquityStakeholder, updateEquityStakeholder } from "./stakeholders.js";
import { terminateEquityStakeholders } from "./stakeholders-actions.js";

type ChangeRow = Prisma.EquityStakeholderChangeGetPayload<object>;
type PropertyRow = Prisma.EquityStakeholderPropertyGetPayload<object>;

/** The contract's change fields, in the order the review table shows them. */
const CHANGE_FIELDS = [
  "firstName",
  "lastName",
  "contactEmail",
  "dateOfBirth",
  "taxId",
  "jobTitle",
  "costCenter",
  "department",
  "address",
] as const;
type ChangeField = (typeof CHANGE_FIELDS)[number];

/** Proposed fields that live on the stakeholder row rather than in a dated property. */
const ROW_FIELDS = ["firstName", "lastName", "contactEmail", "dateOfBirth", "taxId"] as const;
/** Proposed fields kept as dated properties of the same kind. */
const PROPERTY_FIELDS = {
  jobTitle: "job_title",
  costCenter: "cost_center",
  department: "department",
} as const;

const ADDRESS_FIELDS = ["country", "street", "city", "state", "postalCode"] as const;

const proposedOf = (value: Prisma.JsonValue): EquityChangeProposed =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as EquityChangeProposed)
    : {};

function toChange(row: ChangeRow, stakeholderName: string | null): EquityStakeholderChange {
  return {
    id: row.id,
    kind: row.kind as EquityStakeholderChange["kind"],
    source: row.source as EquityStakeholderChange["source"],
    stakeholderId: row.stakeholderId,
    stakeholderName,
    employeeId: row.employeeId,
    externalName: row.externalName,
    externalEmail: row.externalEmail,
    proposed: proposedOf(row.proposed),
    terminationDate: fromDateOrNull(row.terminationDate),
    status: row.status as EquityStakeholderChange["status"],
    acceptedFields: (row.acceptedFields ?? []) as EquityStakeholderChange["acceptedFields"],
    resolvedAt: row.resolvedAt === null ? null : iso(row.resolvedAt),
    createdAt: iso(row.createdAt),
  };
}

/** The names of the stakeholders a page of changes references, in one scoped query. */
async function stakeholderNames(prisma: EquityDb, actor: EquityScope, ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (!wanted.length) return new Map<string, string>();
  const rows = await prisma.equityStakeholder.findMany({
    where: { id: { in: wanted }, ...scopeOf(actor) },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function listEquityStakeholderChanges(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderChangeListInputSchema>,
): Promise<z.infer<typeof EquityStakeholderChangePageSchema>> {
  const input = ChangeListInputSchema.parse(raw);
  const where: Prisma.EquityStakeholderChangeWhereInput = {
    ...scopeOf(actor),
    status: input.status,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.search
      ? {
          OR: [
            { externalName: contains(input.search) },
            { externalEmail: contains(input.search) },
            { employeeId: contains(input.search) },
          ],
        }
      : {}),
  };
  const sort = input.sort ?? { field: "createdAt", dir: "desc" };
  const orderBy: Prisma.EquityStakeholderChangeOrderByWithRelationInput[] = [
    { [sort.field]: sort.dir },
    { id: "asc" },
  ];
  const [rows, total] = await Promise.all([
    prisma.equityStakeholderChange.findMany({ where, orderBy, ...pageArgs(input) }),
    prisma.equityStakeholderChange.count({ where }),
  ]);
  const names = await stakeholderNames(
    prisma,
    actor,
    rows.map((row) => row.stakeholderId),
  );
  return pageOf(
    rows.map((row) =>
      toChange(row, row.stakeholderId ? (names.get(row.stakeholderId) ?? null) : null),
    ),
    total,
    input,
  );
}

export async function countEquityStakeholderChanges(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<z.infer<typeof EquityStakeholderChangeCountsSchema>> {
  const scope = scopeOf(actor);
  const [groups, lastProposed] = await Promise.all([
    prisma.equityStakeholderChange.groupBy({
      by: ["kind"],
      where: { ...scope, status: "pending" },
      _count: { _all: true },
    }),
    prisma.equityStakeholderChange.findFirst({
      where: { ...scope, status: "pending", kind: "profile" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true },
    }),
  ]);
  const count = (kind: string) => groups.find((group) => group.kind === kind)?._count._all ?? 0;
  return {
    match: count("match"),
    termination: count("termination"),
    profile: count("profile"),
    lastProposedAt: lastProposed ? iso(lastProposed.createdAt) : null,
  };
}

// ---- import ----

type MatchableRow = {
  id: string;
  employeeId: string | null;
  contactEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: Date | null;
  taxId: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  department: string | null;
  addresses: Prisma.JsonValue;
  terminatedAt: Date | null;
};

const text = (value: string | null | undefined) => (value ?? "").trim();

const email = (value: string | null | undefined) => text(value).toLowerCase();

const addressesOf = (value: Prisma.JsonValue): EquityAddress[] =>
  Array.isArray(value) ? (value as EquityAddress[]) : [];

const sameAddress = (a: EquityAddress | undefined, b: EquityAddress | undefined) =>
  ADDRESS_FIELDS.every((field) => text(a?.[field]) === text(b?.[field]));

/** The proposed fields that differ from what the stakeholder holds today. */
function differingFields(row: MatchableRow, proposed: EquityChangeProposed): EquityChangeProposed {
  const differing: EquityChangeProposed = {};
  for (const field of ROW_FIELDS) {
    const value = proposed[field];
    if (value === undefined) continue;
    const stored =
      field === "dateOfBirth"
        ? (fromDateOrNull(row.dateOfBirth) ?? "")
        : field === "contactEmail"
          ? text(row.contactEmail)
          : field === "firstName"
            ? text(row.firstName)
            : field === "lastName"
              ? text(row.lastName)
              : text(row.taxId);
    if (value !== stored) differing[field] = value as never;
  }
  for (const field of Object.keys(PROPERTY_FIELDS) as Array<keyof typeof PROPERTY_FIELDS>) {
    const value = proposed[field];
    if (value === undefined) continue;
    const stored = text(row[field]);
    if (value !== stored) differing[field] = value;
  }
  if (
    proposed.address !== undefined &&
    !sameAddress(proposed.address, addressesOf(row.addresses)[0])
  )
    differing.address = proposed.address;
  return differing;
}

type Draft = {
  kind: EquityStakeholderChange["kind"];
  stakeholderId: string | null;
  employeeId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  proposed: EquityChangeProposed;
  terminationDate: string | null;
  key: string;
};

/** The key a pending change is deduplicated by: its stakeholder and kind, or the external row. */
const draftKey = (draft: Draft) =>
  draft.stakeholderId
    ? `${draft.kind}:${draft.stakeholderId}`
    : `${draft.kind}:external:${text(draft.employeeId).toLowerCase()}|${email(draft.externalEmail)}`;

export async function importEquityStakeholderChanges(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityChangeImportInputSchema>,
): Promise<z.infer<typeof EquityChangeImportResultSchema>> {
  const input = ImportInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const [stakeholders, pending] = await Promise.all([
      tx.equityStakeholder.findMany({
        where: { ...scope, mergedIntoId: null },
        select: {
          id: true,
          employeeId: true,
          contactEmail: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          taxId: true,
          jobTitle: true,
          costCenter: true,
          department: true,
          addresses: true,
          terminatedAt: true,
        },
      }),
      tx.equityStakeholderChange.findMany({
        where: { ...scope, status: "pending" },
        select: {
          id: true,
          kind: true,
          stakeholderId: true,
          employeeId: true,
          externalEmail: true,
          proposed: true,
          terminationDate: true,
        },
      }),
    ]);

    const byEmployeeId = new Map<string, MatchableRow>();
    const byEmail = new Map<string, MatchableRow>();
    for (const stakeholder of stakeholders) {
      const employeeId = text(stakeholder.employeeId);
      if (employeeId && !byEmployeeId.has(employeeId)) byEmployeeId.set(employeeId, stakeholder);
      const mail = email(stakeholder.contactEmail);
      if (mail && !byEmail.has(mail)) byEmail.set(mail, stakeholder);
    }

    const pendingById = new Map<string, (typeof pending)[number]>();
    for (const change of pending) {
      const key = change.stakeholderId
        ? `${change.kind}:${change.stakeholderId}`
        : `${change.kind}:external:${text(change.employeeId).toLowerCase()}|${email(change.externalEmail)}`;
      if (!pendingById.has(key)) pendingById.set(key, change);
    }

    const result: z.infer<typeof EquityChangeImportResultSchema> = {
      match: 0,
      termination: 0,
      profile: 0,
      unchanged: 0,
    };
    const touched: string[] = [];
    for (const row of input.rows) {
      const employeeId = text(row.employeeId) || null;
      const externalEmail = row.email ? row.email : null;
      const match =
        (employeeId ? byEmployeeId.get(employeeId) : undefined) ??
        (externalEmail ? byEmail.get(email(externalEmail)) : undefined);

      let draft: Draft | null = null;
      if (!match) {
        draft = {
          kind: "match",
          stakeholderId: null,
          employeeId,
          externalName: row.name,
          externalEmail,
          proposed: row.proposed,
          terminationDate: null,
          key: "",
        };
      } else if (row.terminationDate && !match.terminatedAt) {
        draft = {
          kind: "termination",
          stakeholderId: match.id,
          employeeId,
          externalName: row.name,
          externalEmail,
          proposed: row.proposed,
          terminationDate: row.terminationDate,
          key: "",
        };
      } else {
        const differing = differingFields(match, row.proposed);
        if (!Object.keys(differing).length) {
          result.unchanged += 1;
          continue;
        }
        draft = {
          kind: "profile",
          stakeholderId: match.id,
          employeeId,
          externalName: row.name,
          externalEmail,
          proposed: differing,
          terminationDate: null,
          key: "",
        };
      }

      draft.key = draftKey(draft);
      const existing = pendingById.get(draft.key);
      if (existing) {
        // Already queued: refresh what it proposes instead of adding a duplicate row.
        const updated = await tx.equityStakeholderChange.update({
          where: { id: existing.id },
          data: {
            proposed: draft.proposed as Prisma.InputJsonValue,
            terminationDate: toDateOrNull(draft.terminationDate) ?? null,
          },
          select: { id: true },
        });
        existing.proposed = draft.proposed;
        pendingById.set(draft.key, { ...existing, id: updated.id });
        touched.push(updated.id);
        result[draft.kind] += 1;
        continue;
      }
      const created = await tx.equityStakeholderChange.create({
        data: {
          ...scope,
          kind: draft.kind,
          source: "file",
          stakeholderId: draft.stakeholderId,
          employeeId: draft.employeeId,
          externalName: draft.externalName,
          externalEmail: draft.externalEmail,
          proposed: draft.proposed as Prisma.InputJsonValue,
          terminationDate: toDateOrNull(draft.terminationDate) ?? null,
          status: "pending",
        },
        select: { id: true },
      });
      touched.push(created.id);
      pendingById.set(draft.key, {
        id: created.id,
        kind: draft.kind,
        stakeholderId: draft.stakeholderId,
        employeeId: draft.employeeId,
        externalEmail: draft.externalEmail,
        proposed: draft.proposed,
        terminationDate: toDateOrNull(draft.terminationDate) ?? null,
      });
      result[draft.kind] += 1;
    }
    await applyPreferences(tx, scope, touched, result);
    return result;
  });
}

const AUTO_FIELDS: Record<string, ChangeField> = {
  address: "address",
  cost_center: "costCenter",
  department: "department",
  job_title: "jobTitle",
  tax_id: "taxId",
};

/**
 * The automation preferences: with auto updates on, the chosen fields of a profile change apply
 * at once and only the rest wait for review; with auto creation on, an unmatched employee becomes
 * a stakeholder.
 */
async function applyPreferences(
  tx: Prisma.TransactionClient,
  scope: EquityScope,
  ids: string[],
  result: z.infer<typeof EquityChangeImportResultSchema>,
) {
  const preferences = await getEquityHrisPreferences(tx, scope);
  if (!ids.length || (!preferences.autoUpdates && !preferences.autoCreate)) return;
  const auto = preferences.autoFields.map((field) => AUTO_FIELDS[field]).filter(Boolean);
  const rows = await tx.equityStakeholderChange.findMany({
    where: { id: { in: ids }, ...scope, status: "pending" },
  });
  for (const row of rows) {
    if (row.kind === "profile" && preferences.autoUpdates) {
      const proposed = proposedOf(row.proposed) as Record<string, unknown>;
      const fields = (Object.keys(proposed) as ChangeField[]).filter(
        (field) => auto.includes(field) && proposed[field] !== undefined,
      );
      if (!fields.length) continue;
      await applyProfile(tx, scope, row, fields);
      const rest = Object.fromEntries(
        Object.entries(proposed).filter(([field]) => !fields.includes(field as ChangeField)),
      );
      const done = Object.keys(rest).length === 0;
      await tx.equityStakeholderChange.update({
        where: { id: row.id },
        data: done
          ? { status: "accepted", resolvedAt: new Date(), acceptedFields: fields }
          : { proposed: rest as Prisma.InputJsonValue },
      });
      result.applied = (result.applied ?? 0) + 1;
      if (done) result.profile -= 1;
    } else if (row.kind === "match" && preferences.autoCreate) {
      await resolveEquityStakeholderChange(tx, scope, {
        id: row.id,
        decision: "accept",
        create: true,
      });
      result.match -= 1;
      result.created = (result.created ?? 0) + 1;
    }
  }
}

/**
 * A holder's own proposed profile values (from the portfolio): queued as a pending `profile`
 * change with source `portfolio`, holding only the fields that differ from the record. Returns
 * null when nothing differs. A pending portfolio change for the same holder is replaced.
 */
export async function proposeEquityStakeholderChange(
  prisma: EquityDb,
  actor: EquityScope,
  raw: { stakeholderId: string; proposed: z.input<typeof EquityChangeProposedSchema> },
): Promise<EquityStakeholderChange | null> {
  const proposed = EquityChangeProposedSchema.parse(raw.proposed);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const row = await tx.equityStakeholder.findFirst({
      where: { id: raw.stakeholderId, ...scope, mergedIntoId: null },
    });
    if (!row) throw notFound("Stakeholder");
    const differing = differingFields(row, proposed);
    if (!Object.keys(differing).length) return null;
    await tx.equityStakeholderChange.deleteMany({
      where: {
        ...scope,
        stakeholderId: row.id,
        kind: "profile",
        source: "portfolio",
        status: "pending",
      },
    });
    const created = await tx.equityStakeholderChange.create({
      data: {
        ...scope,
        kind: "profile",
        source: "portfolio",
        stakeholderId: row.id,
        externalName: row.name,
        externalEmail: row.portfolioEmail ?? row.contactEmail,
        proposed: differing as Prisma.InputJsonValue,
        status: "pending",
      },
    });
    return toChange(created, row.name);
  });
}

// ---- resolve ----

async function applyProfile(
  tx: Prisma.TransactionClient,
  scope: EquityScope,
  change: ChangeRow,
  fields: ChangeField[],
): Promise<void> {
  const stakeholderId = change.stakeholderId;
  if (!stakeholderId) throw new EquityInputError("This change is not linked to a stakeholder");
  await assertInLedger(tx, scope, "equityStakeholder", stakeholderId);
  const proposed = proposedOf(change.proposed) as Record<string, unknown>;
  const changes: Record<string, unknown> = {};
  for (const field of ROW_FIELDS) {
    if (fields.includes(field)) changes[field] = proposed[field];
  }

  const address = fields.includes("address") ? proposedOf(change.proposed).address : undefined;
  if (address) {
    const existing = await tx.equityStakeholder.findFirst({
      where: { id: stakeholderId, ...scope },
      select: { addresses: true },
    });
    if (!existing) throw notFound("Stakeholder");
    changes.addresses = [address, ...addressesOf(existing.addresses).slice(1)];
  }

  const properties: EquityStakeholderUpdateInput["properties"] = [];
  for (const field of Object.keys(PROPERTY_FIELDS) as Array<keyof typeof PROPERTY_FIELDS>) {
    if (!fields.includes(field)) continue;
    const kind = PROPERTY_FIELDS[field];
    const existing: PropertyRow[] = await tx.equityStakeholderProperty.findMany({
      where: { stakeholderId, ...scope, kind },
    });
    for (const property of existing)
      properties.push({
        kind: property.kind as "job_title" | "cost_center" | "department",
        effectiveDate: property.effectiveDate.toISOString().slice(0, 10),
        value: property.value,
      });
    const value = proposed[field];
    if (typeof value === "string") properties.push({ kind, effectiveDate: today(), value });
  }

  await updateEquityStakeholder(tx, scope, {
    ...(changes as EquityStakeholderUpdateInput),
    ...(properties.length ? { properties } : {}),
    id: stakeholderId,
  });
}

export async function resolveEquityStakeholderChange(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderChangeResolveInputSchema>,
): Promise<EquityStakeholderChange> {
  const input = ChangeResolveInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    // Ledger first, then the holder rows in sorted order (the portal proposal takes them the same
    // way), so a reviewer's accept and a holder's re-proposal queue up instead of deadlocking.
    await lockEquityLedger(tx, scope);
    const change = await tx.equityStakeholderChange.findFirst({
      where: { id: input.id, ...scope },
    });
    if (!change) throw notFound("Stakeholder change");
    // An unknown or foreign holder is an input error, as before, not a missing lock target.
    if (input.stakeholderId)
      await assertInLedger(tx, scope, "equityStakeholder", input.stakeholderId);
    await lockEquityStakeholders(
      tx,
      scope,
      [change.stakeholderId, input.stakeholderId].filter((id): id is string => !!id),
    );
    // Claim the pending row first. The conditional update takes the row lock, so a concurrent
    // resolve waits, sees the new status and fails instead of applying the change a second time.
    const claimed = await tx.equityStakeholderChange.updateMany({
      where: { id: change.id, ...scope, status: "pending" },
      data: {
        status: input.decision === "reject" ? "rejected" : "accepted",
        resolvedAt: new Date(),
      },
    });
    if (claimed.count !== 1) throw new EquityInputError("This change has already been resolved");

    let acceptedFields: string[] = [];
    let stakeholderId = change.stakeholderId;
    let employeeId = change.employeeId;

    if (input.decision === "reject")
      return toChange(
        await tx.equityStakeholderChange.findFirstOrThrow({ where: { id: change.id, ...scope } }),
        null,
      );

    if (change.kind === "profile") {
      const fields = input.fields ?? [];
      if (!fields.length) throw new EquityInputError("Choose at least one field to accept");
      const proposed = proposedOf(change.proposed) as Record<string, unknown>;
      for (const field of fields) {
        if (!CHANGE_FIELDS.includes(field))
          throw new EquityInputError(`Unknown change field: ${field}`);
        if (!(field in proposed))
          throw new EquityInputError(`This change does not propose ${field}`);
      }
      await applyProfile(tx, scope, change, fields as ChangeField[]);
      acceptedFields = fields;
      if (!stakeholderId) throw new EquityInputError("This change is not linked to a stakeholder");
    } else if (change.kind === "match") {
      if (input.stakeholderId) {
        await assertInLedger(tx, scope, "equityStakeholder", input.stakeholderId);
        stakeholderId = input.stakeholderId;
        if (change.employeeId)
          await tx.equityStakeholder.update({
            where: { id: input.stakeholderId },
            data: { employeeId: change.employeeId },
          });
      } else if (input.create) {
        const proposed = proposedOf(change.proposed);
        const created = await createEquityStakeholder(tx, scope, {
          type: "individual",
          name:
            change.externalName ??
            [proposed.firstName, proposed.lastName].filter(Boolean).join(" ").trim() ??
            "",
          firstName: proposed.firstName ?? null,
          lastName: proposed.lastName ?? null,
          contactEmail: change.externalEmail ?? proposed.contactEmail ?? null,
          dateOfBirth: proposed.dateOfBirth ?? null,
          taxId: proposed.taxId ?? null,
          employeeId: change.employeeId,
          addresses: proposed.address ? [proposed.address] : [],
        });
        stakeholderId = created.id;
      } else {
        throw new EquityInputError("Choose a stakeholder to link, or create one");
      }
      employeeId = change.employeeId ?? employeeId;
    } else if (change.kind === "termination") {
      if (!change.stakeholderId)
        throw new EquityInputError("This change is not linked to a stakeholder");
      if (!change.terminationDate)
        throw new EquityInputError("This change has no termination date");
      await assertInLedger(tx, scope, "equityStakeholder", change.stakeholderId);
      // The same terminate as the list's: the date and the matching ex- relationship. A holder
      // with no working relationship (or already terminated) only gets the date.
      const holder = await tx.equityStakeholder.findFirst({
        where: { id: change.stakeholderId, ...scope },
        select: { relationship: true, terminatedAt: true, mergedIntoId: true },
      });
      const terminable =
        holder?.relationship &&
        holder.relationship !== "investor" &&
        !holder.relationship.startsWith("ex_") &&
        !holder.terminatedAt &&
        !holder.mergedIntoId;
      if (terminable)
        await terminateEquityStakeholders(tx, scope, {
          ids: [change.stakeholderId],
          terminationDate: fromDate(change.terminationDate),
        });
      else
        await tx.equityStakeholder.update({
          where: { id: change.stakeholderId },
          data: { terminatedAt: change.terminationDate },
        });
      stakeholderId = change.stakeholderId;
    } else {
      throw new EquityInputError(`Unknown change kind: ${change.kind}`);
    }

    const row = await tx.equityStakeholderChange.update({
      where: { id: change.id },
      data: {
        status: "accepted",
        resolvedAt: new Date(),
        stakeholderId,
        employeeId,
        acceptedFields,
      },
    });
    const names = await stakeholderNames(tx, scope, [row.stakeholderId]);
    return toChange(row, row.stakeholderId ? (names.get(row.stakeholderId) ?? null) : null);
  });
}

// ---- HRIS preferences ----

const DEFAULT_PREFERENCES: EquityHrisPreferences = {
  autoUpdates: false,
  autoFields: [],
  autoCreate: false,
};

export async function getEquityHrisPreferences(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquityHrisPreferences> {
  const row = await prisma.equityHrisPreferences.findUnique({
    where: { spaceId_userId: scopeOf(actor) },
  });
  if (!row) return DEFAULT_PREFERENCES;
  return {
    autoUpdates: row.autoUpdates,
    autoFields: (row.autoFields ?? []) as EquityHrisPreferences["autoFields"],
    autoCreate: row.autoCreate,
  };
}

export async function setEquityHrisPreferences(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityHrisPreferencesSchema>,
): Promise<EquityHrisPreferences> {
  const input = HrisPreferencesSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const row = await tx.equityHrisPreferences.upsert({
      where: { spaceId_userId: scope },
      create: { ...scope, ...input },
      update: input,
    });
    return {
      autoUpdates: row.autoUpdates,
      autoFields: (row.autoFields ?? []) as EquityHrisPreferences["autoFields"],
      autoCreate: row.autoCreate,
    };
  });
}
