import { createHash } from "node:crypto";
import type {
  Actor,
  CompanyEdgeImportInput,
  CompanyEntityEditInput,
  CompanyEntityImportInput,
  CompanyEventImportInput,
  CompanyPartialDate,
} from "@rakazo/contracts";
import {
  CompanyConfirmInputSchema,
  CompanyEdgeImportInputSchema,
  CompanyEntityEditInputSchema,
  CompanyEntityImportInputSchema,
  CompanyEventImportInputSchema,
  CompanyMergeInputSchema,
  CompanyRejectInputSchema,
  companyEntityIdentifiers,
  normalizeCompanyName,
} from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { IsolationError } from "./scope.js";
import { withTransactionRetry } from "./transaction-retry.js";

type Scope = { spaceId: string; ownerUserId: string };
type CompanyDb = PrismaClient | Prisma.TransactionClient;
type RootDb = PrismaClient;

export type CompanyEvidenceRecord = {
  id: string;
  factKind: string;
  factId: string;
  stance: string;
  sourceKind: string;
  sourceItemId: string;
  sourceKey: string;
  sourceUrl: string | null;
  quote: string;
  contentHash: string;
  extractedAt: string;
  confidence: number;
};

export type CompanyEntityRecord = {
  id: string;
  kind: string;
  displayName: string;
  normalizedName: string;
  attrs: Record<string, unknown>;
  confidence: number;
  status: string;
  visibility: string;
  lockedFields: string[];
  confirmedAt: string | null;
  identities: Array<{ id: string; identityType: string; identityValue: string }>;
  evidence: CompanyEvidenceRecord[];
  mergedFrom: string[];
  edges: Array<{
    id: string;
    fromId: string;
    toId: string;
    relation: string;
    startsOn: string | null;
    endsOn: string | null;
    role: string | null;
    evidence: CompanyEvidenceRecord[];
  }>;
  events: Array<{
    id: string;
    kind: string;
    title: string;
    occursOn: string;
    entityIds: string[];
    evidence: CompanyEvidenceRecord[];
  }>;
  contact: unknown;
  legalContract: unknown;
  dataRoomItem: unknown;
};

export type CompanyCandidateRecord = {
  id: string;
  kind: string;
  reason: string;
  entityIds: string[];
  proposedFact: unknown;
  sourceKind: string;
  sourceItemId: string;
  sourceKey: string;
  quote: string;
  createdAt: string;
};

export type CompanySuppressedResult = { suppressed: true; record: null; rejectionId: string };
export type CompanyWriteResult = CompanyEntityRecord | CompanySuppressedResult;

const ENTITY_INCLUDE = {
  identities: { select: { id: true, identityType: true, identityValue: true } },
  contact: true,
  legalContract: true,
  dataRoomItem: true,
} as const;

const ownerOf = (actor: Pick<Actor, "spaceId" | "userId">): Scope => ({
  spaceId: actor.spaceId,
  ownerUserId: actor.userId,
});

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateValue(value: CompanyPartialDate | null | undefined): Date | null {
  return value ? new Date(`${value.date}T00:00:00.000Z`) : null;
}

function datePrecision(value: CompanyPartialDate | null | undefined): string | null {
  return value?.precision ?? null;
}

function identityParts(input: CompanyEntityImportInput["entity"]): Array<[string, string]> {
  return companyEntityIdentifiers(input).map((value) => {
    const separator = value.indexOf(":");
    return [value.slice(0, separator), value.slice(separator + 1)];
  });
}

async function requireMember(db: CompanyDb, scope: Scope): Promise<void> {
  const member = await db.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.ownerUserId } },
    select: { userId: true },
  });
  if (!member) throw new IsolationError("Company access revoked");
}

async function lockScope(db: CompanyDb, scope: Scope): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`company:${scope.spaceId}:${scope.ownerUserId}`}, 0))`;
}

function toEvidence(row: {
  id: string;
  factKind: string;
  factId: string;
  stance: string;
  sourceKind: string;
  sourceItemId: string;
  sourceKey: string;
  sourceUrl: string | null;
  quote: string;
  contentHash: string;
  extractedAt: Date;
  confidence: number;
}): CompanyEvidenceRecord {
  return { ...row, extractedAt: row.extractedAt.toISOString() };
}

async function evidenceFor(
  db: CompanyDb,
  scope: Scope,
  factKind: string,
  factId: string,
): Promise<CompanyEvidenceRecord[]> {
  const rows = await db.companyEvidence.findMany({
    where: { ...scope, factKind, factId },
    orderBy: [{ extractedAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toEvidence);
}

async function mapEntity(
  db: CompanyDb,
  scope: Scope,
  row: Prisma.CompanyEntityGetPayload<{ include: typeof ENTITY_INCLUDE }>,
): Promise<CompanyEntityRecord> {
  const merges = await db.companyMerge.findMany({
    where: { ...scope, survivorEntityId: row.id },
    select: { sourceEntityId: true },
    orderBy: { createdAt: "asc" },
  });
  const memberIds = [row.id, ...merges.map((merge) => merge.sourceEntityId)];
  const resolveSurvivor = async (entityId: string): Promise<string> => {
    let current = entityId;
    for (;;) {
      const merge = await db.companyMerge.findFirst({
        where: { ...scope, sourceEntityId: current },
        select: { survivorEntityId: true },
      });
      if (!merge) return current;
      current = merge.survivorEntityId;
    }
  };
  const [edgeRows, eventRows] = await Promise.all([
    db.companyEdge.findMany({
      where: {
        ...scope,
        OR: [{ fromId: { in: memberIds } }, { toId: { in: memberIds } }],
      },
      orderBy: [{ startsOn: "asc" }, { id: "asc" }],
    }),
    db.companyEventEntity.findMany({
      where: { ...scope, entityId: { in: memberIds } },
      include: { event: true },
      orderBy: { id: "asc" },
    }),
  ]);
  const eventIds = [...new Set(eventRows.map((link) => link.eventId))];
  const eventEntityRows = eventIds.length
    ? await db.companyEventEntity.findMany({
        where: { ...scope, eventId: { in: eventIds } },
        select: { eventId: true, entityId: true },
      })
    : [];
  const edges = await Promise.all(
    edgeRows.map(async (edge) => ({
      id: edge.id,
      fromId: await resolveSurvivor(edge.fromId),
      toId: await resolveSurvivor(edge.toId),
      relation: edge.relation,
      startsOn: edge.startsOn?.toISOString().slice(0, 10) ?? null,
      endsOn: edge.endsOn?.toISOString().slice(0, 10) ?? null,
      role: edge.role,
      evidence: await evidenceFor(db, scope, "edge", edge.id),
    })),
  );
  const uniqueEventLinks = [...new Map(eventRows.map((link) => [link.eventId, link])).values()];
  const events = await Promise.all(
    uniqueEventLinks.map(async (link) => ({
      id: link.event.id,
      kind: link.event.kind,
      title: link.event.title,
      occursOn: link.event.occursOn.toISOString().slice(0, 10),
      entityIds: [
        ...new Set(
          await Promise.all(
            eventEntityRows
              .filter((eventLink) => eventLink.eventId === link.eventId)
              .map((eventLink) => resolveSurvivor(eventLink.entityId)),
          ),
        ),
      ],
      evidence: await evidenceFor(db, scope, "event", link.event.id),
    })),
  );
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    normalizedName: row.normalizedName,
    attrs: row.attrs as Record<string, unknown>,
    confidence: row.confidence,
    status: row.status,
    visibility: row.visibility,
    lockedFields: row.lockedFields,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    identities: row.identities,
    evidence: (
      await Promise.all(memberIds.map((entityId) => evidenceFor(db, scope, "entity", entityId)))
    ).flat(),
    mergedFrom: merges.map((merge) => merge.sourceEntityId),
    edges,
    events,
    contact: row.contact,
    legalContract: row.legalContract,
    dataRoomItem: row.dataRoomItem,
  };
}

async function hiddenIds(db: CompanyDb, scope: Scope): Promise<Set<string>> {
  const rows = await db.companyMerge.findMany({
    where: scope,
    select: { sourceEntityId: true },
  });
  return new Set(rows.map((row) => row.sourceEntityId));
}

function sourceKey(sourceKind: string, sourceItemId: string): string {
  return `${sourceKind}:${sourceItemId}`;
}

async function findSuppression(
  db: CompanyDb,
  scope: Scope,
  aliases: string[],
): Promise<{ id: string } | null> {
  if (aliases.length === 0) return null;
  return db.companyRejection.findFirst({
    where: { ...scope, identityAliases: { hasSome: aliases } },
    select: { id: true },
  });
}

async function createCandidate(
  db: CompanyDb,
  scope: Scope,
  data: {
    kind: string;
    reason: string;
    entityIds: string[];
    proposedFact: unknown;
    sourceKind: string;
    sourceItemId: string;
    sourceKey: string;
    quote: string;
    contentHash: string;
  },
): Promise<void> {
  await db.companyCandidate.create({
    data: {
      ...scope,
      ...data,
      proposedFact: data.proposedFact as Prisma.InputJsonValue,
    },
  });
}

function entityAliases(input: CompanyEntityImportInput["entity"]): string[] {
  return [...companyEntityIdentifiers(input), `name:${normalizeCompanyName(input.displayName)}`];
}

async function importEntity(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEntityImportInput,
): Promise<CompanyWriteResult> {
  const input = CompanyEntityImportInputSchema.parse(raw);
  const key = sourceKey(input.evidence.sourceKind, input.evidence.sourceItemId);
  const existingEvidence = await db.companyEvidence.findFirst({
    where: {
      ...scope,
      factKind: "entity",
      sourceKey: key,
      contentHash: input.evidence.contentHash,
    },
    select: { factId: true },
  });
  if (existingEvidence) {
    const row = await db.companyEntity.findFirst({
      where: { ...scope, id: existingEvidence.factId },
      include: ENTITY_INCLUDE,
    });
    if (row) return mapEntity(db, scope, row);
  }

  const aliases = entityAliases(input.entity);
  const rejection = await findSuppression(db, scope, aliases);
  if (rejection) return { suppressed: true, record: null, rejectionId: rejection.id };

  const identifiers = identityParts(input.entity);
  const matches = identifiers.length
    ? await db.companyIdentity.findMany({
        where: {
          ...scope,
          OR: identifiers.map(([identityType, identityValue]) => ({ identityType, identityValue })),
        },
        select: { entityId: true, identityType: true, identityValue: true },
      })
    : [];
  const matchedIds = [...new Set(matches.map((match) => match.entityId))];
  let entityId: string | undefined;
  if (matchedIds.length === 1) {
    entityId = matchedIds[0];
  } else if (matchedIds.length > 1) {
    await createCandidate(db, scope, {
      kind: input.entity.kind,
      reason: "conflicting_strong_identities",
      entityIds: matchedIds,
      proposedFact: input.entity,
      sourceKind: input.evidence.sourceKind,
      sourceItemId: input.evidence.sourceItemId,
      sourceKey: key,
      quote: input.evidence.quote,
      contentHash: input.evidence.contentHash,
    });
  } else if (input.entity.kind === "company") {
    const company = await db.companyEntity.findFirst({
      where: { ...scope, kind: "company" },
      include: ENTITY_INCLUDE,
    });
    if (company) entityId = company.id;
  } else if (input.entity.kind === "organisation") {
    const existing = await db.companyEntity.findFirst({
      where: {
        ...scope,
        kind: "organisation",
        normalizedName: normalizeCompanyName(input.entity.displayName),
      },
      include: ENTITY_INCLUDE,
    });
    if (existing) entityId = existing.id;
  }

  if (!entityId && input.entity.kind === "person") {
    const normalizedName = normalizeCompanyName(input.entity.displayName);
    const sameName = await db.companyEntity.findMany({
      where: { ...scope, kind: "person", normalizedName },
      select: { id: true },
    });
    const localParts = identifiers
      .filter(([identityType]) => identityType === "email")
      .map(([, identityValue]) => identityValue.split("@", 1)[0]?.toLowerCase())
      .filter((localPart): localPart is string => Boolean(localPart));
    const allPeople = localParts.length
      ? await db.companyEntity.findMany({
          where: { ...scope, kind: "person" },
          select: { id: true, attrs: true },
        })
      : [];
    const localPartMatches = allPeople
      .filter((person) => {
        const emails = (person.attrs as { workEmails?: unknown }).workEmails;
        return (
          Array.isArray(emails) &&
          emails.some(
            (email) =>
              typeof email === "string" &&
              localParts.includes(email.split("@", 1)[0]?.toLowerCase() ?? ""),
          )
        );
      })
      .map((person) => person.id);
    const candidateIds = [
      ...new Set([...sameName.map((person) => person.id), ...localPartMatches]),
    ];
    if (candidateIds.length > 0) {
      await createCandidate(db, scope, {
        kind: "person",
        reason: sameName.length > 0 ? "name_only_person_candidate" : "email_local_part_candidate",
        entityIds: candidateIds,
        proposedFact: input.entity,
        sourceKind: input.evidence.sourceKind,
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: key,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
      });
    }
  }

  if (entityId) {
    const merge = await db.companyMerge.findFirst({
      where: { ...scope, sourceEntityId: entityId },
      select: { survivorEntityId: true },
    });
    if (merge) entityId = merge.survivorEntityId;
    const existingEntity = await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: entityId },
      select: { attrs: true, displayName: true, lockedFields: true },
    });
    const contradictsLockedValue =
      (existingEntity.lockedFields.includes("displayName") &&
        existingEntity.displayName !== input.entity.displayName) ||
      Object.entries(input.entity.attrs).some(([key, value]) => {
        const storedValue = (existingEntity.attrs as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          return value.some(
            (item, index) =>
              existingEntity.lockedFields.includes(`attrs.${key}[${index}]`) &&
              JSON.stringify((storedValue as unknown[] | undefined)?.[index]) !==
                JSON.stringify(item),
          );
        }
        return (
          existingEntity.lockedFields.includes(`attrs.${key}`) &&
          JSON.stringify(storedValue) !== JSON.stringify(value)
        );
      });
    await db.companyEvidence.createMany({
      data: [
        {
          ...scope,
          factKind: "entity",
          factId: entityId,
          stance: contradictsLockedValue ? "contradicts" : input.evidence.stance,
          sourceKind: input.evidence.sourceKind,
          connectionId: input.evidence.connectionId ?? null,
          mcpServerId: input.evidence.mcpServerId ?? null,
          sourceItemId: input.evidence.sourceItemId,
          sourceKey: key,
          sourceUrl: input.evidence.sourceUrl ?? null,
          quote: input.evidence.quote,
          contentHash: input.evidence.contentHash,
          extractedAt: new Date(input.evidence.extractedAt),
          extractorRunId: input.evidence.extractorRunId ?? null,
          extractorModel: input.evidence.extractorModel ?? Prisma.JsonNull,
          confidence: input.evidence.confidence,
        },
      ],
      skipDuplicates: true,
    });
    const currentAttrs = existingEntity.attrs as Record<string, unknown>;
    const updatedAttrs = { ...currentAttrs };
    for (const [key, value] of Object.entries(input.entity.attrs)) {
      if (existingEntity.lockedFields.includes(`attrs.${key}`)) continue;
      if (!Array.isArray(value)) {
        updatedAttrs[key] = value;
        continue;
      }
      const nextValue = [...value];
      for (const path of existingEntity.lockedFields) {
        const prefix = `attrs.${key}[`;
        if (!path.startsWith(prefix) || !path.endsWith("]")) continue;
        const index = Number(path.slice(prefix.length, -1));
        if (!Number.isInteger(index) || index < 0) continue;
        const existingValue = (currentAttrs[key] as unknown[] | undefined)?.[index];
        if (existingValue !== undefined) {
          while (nextValue.length <= index) nextValue.push(null);
          nextValue[index] = existingValue;
        }
      }
      updatedAttrs[key] = nextValue;
    }
    const displayName = existingEntity.lockedFields.includes("displayName")
      ? existingEntity.displayName
      : input.entity.displayName;
    await db.companyEntity.update({
      where: { id: entityId },
      data: {
        displayName,
        normalizedName: normalizeCompanyName(displayName),
        attrs: updatedAttrs as Prisma.InputJsonValue,
        confidence: input.entity.confidence,
      },
    });
    if (identifiers.length > 0 && matchedIds.length <= 1) {
      await db.companyIdentity.createMany({
        data: identifiers.map(([identityType, identityValue]) => ({
          ...scope,
          entityId: entityId!,
          identityType,
          identityValue,
        })),
        skipDuplicates: true,
      });
    }
    const row = await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: entityId },
      include: ENTITY_INCLUDE,
    });
    return mapEntity(db, scope, row);
  }

  const id = `company_${hash({ scope, input: input.entity, key }).slice(0, 24)}`;
  const row = await db.companyEntity.create({
    data: {
      id,
      ...scope,
      kind: input.entity.kind,
      displayName: input.entity.displayName,
      normalizedName: normalizeCompanyName(input.entity.displayName),
      attrs: input.entity.attrs as Prisma.InputJsonValue,
      confidence: input.entity.confidence,
      contactId: input.entity.contactId ?? null,
      legalContractId: input.entity.legalContractId ?? null,
      dataRoomItemId: input.entity.dataRoomItemId ?? null,
    },
    include: ENTITY_INCLUDE,
  });
  await db.companyEvidence.create({
    data: {
      ...scope,
      factKind: "entity",
      factId: row.id,
      stance: input.evidence.stance,
      sourceKind: input.evidence.sourceKind,
      connectionId: input.evidence.connectionId ?? null,
      mcpServerId: input.evidence.mcpServerId ?? null,
      sourceItemId: input.evidence.sourceItemId,
      sourceKey: key,
      sourceUrl: input.evidence.sourceUrl ?? null,
      quote: input.evidence.quote,
      contentHash: input.evidence.contentHash,
      extractedAt: new Date(input.evidence.extractedAt),
      extractorRunId: input.evidence.extractorRunId ?? null,
      extractorModel: input.evidence.extractorModel ?? Prisma.JsonNull,
      confidence: input.evidence.confidence,
    },
  });
  if (matchedIds.length > 1) {
    // Conflicting identifiers remain candidates; none is attached to the new entity.
    return mapEntity(db, scope, row);
  }
  if (identifiers.length > 0 && matchedIds.length <= 1) {
    await db.companyIdentity.createMany({
      data: identifiers.map(([identityType, identityValue]) => ({
        ...scope,
        entityId: row.id,
        identityType,
        identityValue,
      })),
      skipDuplicates: true,
    });
  }
  return mapEntity(db, scope, row);
}

async function importEdge(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEdgeImportInput,
): Promise<CompanyEdgeImportInput> {
  const input = CompanyEdgeImportInputSchema.parse(raw);
  const startsOn = dateValue(input.edge.startsOn);
  const endsOn = dateValue(input.edge.endsOn);
  const edge = await db.companyEdge.findFirst({
    where: {
      ...scope,
      fromId: input.edge.fromId,
      toId: input.edge.toId,
      relation: input.edge.relation,
      startsOn,
      endsOn,
      startsPrecision: datePrecision(input.edge.startsOn),
      endsPrecision: datePrecision(input.edge.endsOn),
      role: input.edge.role ?? null,
    },
  });
  const row =
    edge ??
    (await db.companyEdge.create({
      data: {
        ...scope,
        fromId: input.edge.fromId,
        toId: input.edge.toId,
        relation: input.edge.relation,
        startsOn,
        startsPrecision: datePrecision(input.edge.startsOn),
        endsOn,
        endsPrecision: datePrecision(input.edge.endsOn),
        role: input.edge.role ?? null,
        confidence: input.edge.confidence,
      },
    }));
  await db.companyEvidence.createMany({
    data: [
      {
        ...scope,
        factKind: "edge",
        factId: row.id,
        stance: input.evidence.stance,
        sourceKind: input.evidence.sourceKind,
        connectionId: input.evidence.connectionId ?? null,
        mcpServerId: input.evidence.mcpServerId ?? null,
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: sourceKey(input.evidence.sourceKind, input.evidence.sourceItemId),
        sourceUrl: input.evidence.sourceUrl ?? null,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
        extractedAt: new Date(input.evidence.extractedAt),
        extractorRunId: input.evidence.extractorRunId ?? null,
        extractorModel: input.evidence.extractorModel ?? Prisma.JsonNull,
        confidence: input.evidence.confidence,
      },
    ],
    skipDuplicates: true,
  });
  return input;
}

async function importEvent(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEventImportInput,
): Promise<CompanyEventImportInput> {
  const input = CompanyEventImportInputSchema.parse(raw);
  const event = await db.companyEvent.findFirst({
    where: {
      ...scope,
      kind: input.event.kind,
      normalizedTitle: normalizeCompanyName(input.event.title),
      occursOn: dateValue(input.event.occursOn)!,
      occursPrecision: input.event.occursOn.precision,
    },
  });
  const row =
    event ??
    (await db.companyEvent.create({
      data: {
        ...scope,
        stream: input.event.stream,
        kind: input.event.kind,
        title: input.event.title,
        normalizedTitle: normalizeCompanyName(input.event.title),
        occursOn: dateValue(input.event.occursOn)!,
        occursPrecision: input.event.occursOn.precision,
        endsOn: dateValue(input.event.endsOn),
        endsPrecision: datePrecision(input.event.endsOn),
        amountCents: input.event.amountCents ?? null,
        currency: input.event.currency ?? null,
        confidence: input.event.confidence,
      },
    }));
  await db.companyEventEntity.createMany({
    data: input.event.entityIds.map((entityId) => ({ ...scope, eventId: row.id, entityId })),
    skipDuplicates: true,
  });
  await db.companyEvidence.createMany({
    data: [
      {
        ...scope,
        factKind: "event",
        factId: row.id,
        stance: input.evidence.stance,
        sourceKind: input.evidence.sourceKind,
        connectionId: input.evidence.connectionId ?? null,
        mcpServerId: input.evidence.mcpServerId ?? null,
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: sourceKey(input.evidence.sourceKind, input.evidence.sourceItemId),
        sourceUrl: input.evidence.sourceUrl ?? null,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
        extractedAt: new Date(input.evidence.extractedAt),
        extractorRunId: input.evidence.extractorRunId ?? null,
        extractorModel: input.evidence.extractorModel ?? Prisma.JsonNull,
        confidence: input.evidence.confidence,
      },
    ],
    skipDuplicates: true,
  });
  return input;
}

function touchedFields(input: CompanyEntityEditInput): Array<[string, unknown]> {
  const fields: Array<[string, unknown]> = [];
  if (input.displayName !== undefined) fields.push(["displayName", input.displayName]);
  for (const [key, value] of Object.entries(input.attrs ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        fields.push([`attrs.${key}[${index}]`, item]);
      });
    } else {
      fields.push([`attrs.${key}`, value]);
    }
  }
  return fields;
}

async function manualEvidence(
  db: CompanyDb,
  scope: Scope,
  entityId: string,
  fieldPath: string,
  value: unknown,
): Promise<string> {
  const contentHash = hash({ entityId, fieldPath, value });
  const row = await db.companyEvidence.upsert({
    where: {
      spaceId_ownerUserId_factKind_factId_sourceKey_contentHash: {
        ...scope,
        factKind: "entity",
        factId: entityId,
        sourceKey: `manual:${entityId}:${fieldPath}`,
        contentHash,
      },
    },
    create: {
      ...scope,
      factKind: "entity",
      factId: entityId,
      stance: "supports",
      sourceKind: "manual",
      sourceItemId: `manual:${entityId}`,
      sourceKey: `manual:${entityId}:${fieldPath}`,
      quote: `Owner correction for ${fieldPath}`,
      contentHash,
      extractedAt: new Date(),
      extractorModel: Prisma.JsonNull,
      confidence: 1,
    },
    update: {},
    select: { id: true },
  });
  return row.id;
}

async function editEntity(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEntityEditInput,
): Promise<CompanyEntityRecord> {
  const input = CompanyEntityEditInputSchema.parse(raw);
  const row = await db.companyEntity.findFirstOrThrow({
    where: { ...scope, id: input.entityId },
    include: ENTITY_INCLUDE,
  });
  if (row.kind !== input.kind) throw new IsolationError("Entity kind does not match edit");
  const updates = touchedFields(input);
  const attrs = { ...(row.attrs as Record<string, unknown>), ...(input.attrs ?? {}) };
  const lockedFields = [...new Set([...row.lockedFields, ...updates.map(([path]) => path)])];
  const evidenceIds = await Promise.all(
    updates.map(([path, value]) => manualEvidence(db, scope, row.id, path, value)),
  );
  await db.companyCorrection.createMany({
    data: updates.map(([fieldPath, value], index) => ({
      ...scope,
      entityId: row.id,
      fieldPath,
      value: value as Prisma.InputJsonValue,
      evidenceId: evidenceIds[index],
    })),
  });
  await db.companyEntity.update({
    where: { id: row.id },
    data: {
      ...(input.displayName === undefined
        ? {}
        : {
            displayName: input.displayName,
            normalizedName: normalizeCompanyName(input.displayName),
          }),
      attrs: attrs as Prisma.InputJsonValue,
      lockedFields,
    },
  });
  return mapEntity(
    db,
    scope,
    await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: row.id },
      include: ENTITY_INCLUDE,
    }),
  );
}

async function confirmEntity(
  db: CompanyDb,
  scope: Scope,
  entityId: string,
): Promise<CompanyEntityRecord> {
  const input = CompanyConfirmInputSchema.parse({ entityId });
  const row = await db.companyEntity.findFirstOrThrow({
    where: { ...scope, id: input.entityId },
    include: ENTITY_INCLUDE,
  });
  await manualEvidence(db, scope, row.id, "status", "confirmed");
  await db.companyEntity.update({
    where: { id: row.id },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
  return mapEntity(
    db,
    scope,
    await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: row.id },
      include: ENTITY_INCLUDE,
    }),
  );
}

async function rejectEntity(
  db: CompanyDb,
  scope: Scope,
  entityId: string,
  reason?: string | null,
): Promise<CompanyEntityRecord> {
  const input = CompanyRejectInputSchema.parse({ entityId, reason });
  const row = await db.companyEntity.findFirstOrThrow({
    where: { ...scope, id: input.entityId },
    include: ENTITY_INCLUDE,
  });
  const aliases = [
    `name:${row.normalizedName}`,
    ...(
      await db.companyIdentity.findMany({
        where: { ...scope, entityId: row.id },
        select: { identityType: true, identityValue: true },
      })
    ).map((identity) => `${identity.identityType}:${identity.identityValue}`),
  ];
  await db.companyRejection.upsert({
    where: { spaceId_ownerUserId_fingerprint: { ...scope, fingerprint: hash(aliases.sort()) } },
    create: {
      ...scope,
      fingerprint: hash(aliases.sort()),
      identityAliases: aliases,
      reason: input.reason ?? null,
    },
    update: { identityAliases: aliases, reason: input.reason ?? null },
  });
  await manualEvidence(db, scope, row.id, "status", "rejected");
  await db.companyEntity.update({
    where: { id: row.id },
    data: { status: "rejected", confirmedAt: null },
  });
  return mapEntity(
    db,
    scope,
    await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: row.id },
      include: ENTITY_INCLUDE,
    }),
  );
}

async function eraseEntity(db: CompanyDb, scope: Scope, entityId: string): Promise<void> {
  const row = await db.companyEntity.findFirst({ where: { ...scope, id: entityId } });
  if (!row) throw new IsolationError("Entity not found");
  const aliases = [
    `name:${row.normalizedName}`,
    ...(
      await db.companyIdentity.findMany({
        where: { ...scope, entityId },
        select: { identityType: true, identityValue: true },
      })
    ).map((identity) => `${identity.identityType}:${identity.identityValue}`),
  ];
  await db.companyRejection.deleteMany({
    where: { ...scope, identityAliases: { hasSome: aliases } },
  });
  await db.companyEntity.delete({ where: { id: row.id } });
}

async function mergeEntities(
  db: CompanyDb,
  scope: Scope,
  sourceEntityId: string,
  survivorEntityId: string,
): Promise<CompanyEntityRecord> {
  const input = CompanyMergeInputSchema.parse({ sourceEntityId, survivorEntityId });
  if (input.sourceEntityId === input.survivorEntityId)
    throw new IsolationError("An entity cannot merge into itself");
  const [source, survivor] = await Promise.all([
    db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: input.sourceEntityId },
      include: ENTITY_INCLUDE,
    }),
    db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: input.survivorEntityId },
      include: ENTITY_INCLUDE,
    }),
  ]);
  if (source.kind !== survivor.kind) throw new IsolationError("Only same-kind entities can merge");
  if (await db.companyMerge.findFirst({ where: { ...scope, sourceEntityId: source.id } })) {
    throw new IsolationError("Entity is already merged");
  }
  if (await db.companyMerge.findFirst({ where: { ...scope, sourceEntityId: survivor.id } })) {
    throw new IsolationError("Chained merges are not allowed");
  }
  await db.companyMerge.create({
    data: { ...scope, sourceEntityId: source.id, survivorEntityId: survivor.id },
  });
  return mapEntity(
    db,
    scope,
    await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: survivor.id },
      include: ENTITY_INCLUDE,
    }),
  );
}

async function splitEntity(db: CompanyDb, scope: Scope, sourceEntityId: string): Promise<void> {
  await db.companyMerge.deleteMany({ where: { ...scope, sourceEntityId } });
}

function writerFor(db: CompanyDb, actor: Actor) {
  const scope = ownerOf(actor);
  const write = async <T>(operation: (tx: CompanyDb) => Promise<T>): Promise<T> => {
    await requireMember(db, scope);
    await lockScope(db, scope);
    return operation(db);
  };
  return {
    importEntity: (input: CompanyEntityImportInput) =>
      write((tx) => importEntity(tx, scope, input)),
    importEdge: (input: CompanyEdgeImportInput) => write((tx) => importEdge(tx, scope, input)),
    importEvent: (input: CompanyEventImportInput) => write((tx) => importEvent(tx, scope, input)),
    edit: (input: CompanyEntityEditInput) => write((tx) => editEntity(tx, scope, input)),
    confirm: (entityId: string) => write((tx) => confirmEntity(tx, scope, entityId)),
    reject: (entityId: string, reason?: string) =>
      write((tx) => rejectEntity(tx, scope, entityId, reason)),
    disconnect: (sourceKind: string, sourceItemId: string) =>
      write(async (tx) => {
        await tx.companyEvidence.deleteMany({
          where: { ...scope, sourceKind, sourceItemId, NOT: { sourceKind: "manual" } },
        });
      }),
    erase: (entityId: string) => write((tx) => eraseEntity(tx, scope, entityId)),
    merge: (sourceEntityId: string, survivorEntityId: string) =>
      write((tx) => mergeEntities(tx, scope, sourceEntityId, survivorEntityId)),
    split: (sourceEntityId: string) => write((tx) => splitEntity(tx, scope, sourceEntityId)),
  };
}

export function companyWriter(tx: Prisma.TransactionClient, actor: Actor) {
  return writerFor(tx, actor);
}

export function companyForActor(prisma: RootDb, actor: Actor) {
  const scope = ownerOf(actor);
  const write = async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
    await requireMember(prisma, scope);
    return withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        await requireMember(tx, scope);
        await lockScope(tx, scope);
        return operation(tx);
      }),
    );
  };
  return {
    list: async (filter: { kind?: string; text?: string; includeMerged?: boolean } = {}) => {
      await requireMember(prisma, scope);
      const rows = await prisma.companyEntity.findMany({
        where: {
          ...scope,
          ...(filter.kind ? { kind: filter.kind } : {}),
          ...(filter.text
            ? {
                OR: [
                  { displayName: { contains: filter.text, mode: "insensitive" } },
                  { normalizedName: { contains: normalizeCompanyName(filter.text) } },
                ],
              }
            : {}),
        },
        include: ENTITY_INCLUDE,
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
      });
      const hidden = filter.includeMerged ? new Set<string>() : await hiddenIds(prisma, scope);
      return Promise.all(
        rows.filter((row) => !hidden.has(row.id)).map((row) => mapEntity(prisma, scope, row)),
      );
    },
    search: async (text: string) => {
      const records = await companyForActor(prisma, actor).list({ text });
      return records;
    },
    count: async (filter: { kind?: string; includeMerged?: boolean } = {}) => {
      await requireMember(prisma, scope);
      const count = await prisma.companyEntity.count({
        where: { ...scope, ...(filter.kind ? { kind: filter.kind } : {}) },
      });
      if (filter.includeMerged) return count;
      const hidden = await hiddenIds(prisma, scope);
      const hiddenInFilter =
        hidden.size === 0
          ? 0
          : await prisma.companyEntity.count({
              where: {
                ...scope,
                id: { in: [...hidden] },
                ...(filter.kind ? { kind: filter.kind } : {}),
              },
            });
      return count - hiddenInFilter;
    },
    detail: async (entityId: string) => {
      await requireMember(prisma, scope);
      if ((await hiddenIds(prisma, scope)).has(entityId)) return null;
      const row = await prisma.companyEntity.findFirst({
        where: { ...scope, id: entityId },
        include: ENTITY_INCLUDE,
      });
      return row ? mapEntity(prisma, scope, row) : null;
    },
    evidence: async (entityId: string) => {
      await requireMember(prisma, scope);
      const row = await prisma.companyEntity.findFirst({
        where: { ...scope, id: entityId },
        select: { id: true },
      });
      if (!row || (await hiddenIds(prisma, scope)).has(entityId)) return [];
      const merges = await prisma.companyMerge.findMany({
        where: { ...scope, survivorEntityId: entityId },
        select: { sourceEntityId: true },
      });
      return (
        await Promise.all(
          [entityId, ...merges.map((merge) => merge.sourceEntityId)].map((id) =>
            evidenceFor(prisma, scope, "entity", id),
          ),
        )
      ).flat();
    },
    candidates: async () => {
      await requireMember(prisma, scope);
      const rows = await prisma.companyCandidate.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(
        (row): CompanyCandidateRecord => ({
          ...row,
          proposedFact: row.proposedFact,
          createdAt: row.createdAt.toISOString(),
        }),
      );
    },
    importEntity: (input: CompanyEntityImportInput) =>
      write((tx) => importEntity(tx, scope, input)),
    importEdge: (input: CompanyEdgeImportInput) => write((tx) => importEdge(tx, scope, input)),
    importEvent: (input: CompanyEventImportInput) => write((tx) => importEvent(tx, scope, input)),
    edit: (input: CompanyEntityEditInput) => write((tx) => editEntity(tx, scope, input)),
    confirm: (entityId: string) => write((tx) => confirmEntity(tx, scope, entityId)),
    reject: (entityId: string, reason?: string) =>
      write((tx) => rejectEntity(tx, scope, entityId, reason)),
    disconnect: (sourceKind: string, sourceItemId: string) =>
      write(async (tx) => {
        await tx.companyEvidence.deleteMany({
          where: { ...scope, sourceKind, sourceItemId, NOT: { sourceKind: "manual" } },
        });
      }),
    erase: (entityId: string) => write((tx) => eraseEntity(tx, scope, entityId)),
    merge: (sourceEntityId: string, survivorEntityId: string) =>
      write((tx) => mergeEntities(tx, scope, sourceEntityId, survivorEntityId)),
    split: (sourceEntityId: string) => write((tx) => splitEntity(tx, scope, sourceEntityId)),
    writer: (tx: Prisma.TransactionClient) => companyWriter(tx, actor),
  };
}
