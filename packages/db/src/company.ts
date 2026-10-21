import { createHash } from "node:crypto";
import type {
  Actor,
  CompanyEdgeEditInput,
  CompanyEdgeImportInput,
  CompanyEntityEditInput,
  CompanyEntityImportInput,
  CompanyEntityInput,
  CompanyEventEditInput,
  CompanyEventImportInput,
  CompanyEvidenceInput,
  CompanyExport,
  CompanyPartialDate,
  CompanyPrivacy,
  CompanySourceLocator,
  CompanyEdgeRecord as ContractCompanyEdgeRecord,
  CompanyEntityRecord as ContractCompanyEntityRecord,
  CompanyEventRecord as ContractCompanyEventRecord,
  CompanyEvidenceRecord as ContractCompanyEvidenceRecord,
} from "@rakazo/contracts";
import {
  CompanyConfirmInputSchema,
  CompanyEdgeEditInputSchema,
  CompanyEdgeImportInputSchema,
  CompanyEntityEditInputSchema,
  CompanyEntityImportInputSchema,
  CompanyEntityInputSchema,
  CompanyEntityKindSchema,
  CompanyEventEditInputSchema,
  CompanyEventImportInputSchema,
  CompanyEvidenceInputSchema,
  CompanyIdentityTypeSchema,
  CompanyMergeInputSchema,
  CompanyRejectInputSchema,
  CompanyStatusSchema,
  CompanyVisibilitySchema,
  companyEntityIdentifiers,
  companyExcludedPersonAliases,
  companyPrivacySourceKey,
  normalizeCompanyName,
} from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { IsolationError } from "./scope.js";
import { withTransactionRetry } from "./transaction-retry.js";

type Scope = { spaceId: string; ownerUserId: string };
type CompanyDb = PrismaClient | Prisma.TransactionClient;
type RootDb = PrismaClient;

export type CompanyEvidenceRecord = ContractCompanyEvidenceRecord;
export type CompanyEdgeRecord = ContractCompanyEdgeRecord;
export type CompanyEventRecord = ContractCompanyEventRecord;
export type CompanyEntityRecord = ContractCompanyEntityRecord;
export class CompanyPrivacyBusinessError extends Error {}

export type CompanyCandidateRecord = {
  id: string;
  kind: string;
  reason: string;
  entityIds: string[];
  proposedFact: unknown;
  sourceKind: string;
  connectionId?: string | null;
  mcpServerId?: string | null;
  dataRoomItemId?: string | null;
  sourceItemId: string;
  sourceKey: string;
  quote: string;
  createdAt: string;
};

export type CompanySuppressedResult = { suppressed: true; record: null; rejectionId: string };
export type CompanyDeferredResult = { deferred: true; record: null; candidateId: string };
export type CompanyWriteResult =
  | CompanyEntityRecord
  | CompanySuppressedResult
  | CompanyDeferredResult;

const ENTITY_INCLUDE = {
  identities: { select: { id: true, identityType: true, identityValue: true } },
} as const;

type EntityGroupMember = Pick<
  Prisma.CompanyEntityGetPayload<object>,
  "id" | "displayName" | "attrs" | "lockedFields"
>;

const ownerOf = (actor: Pick<Actor, "spaceId" | "userId">): Scope => ({
  spaceId: actor.spaceId,
  ownerUserId: actor.userId,
});

function composeEntityGroup(root: EntityGroupMember, members: readonly EntityGroupMember[]) {
  const rootAttrs = root.attrs as Record<string, unknown>;
  const attrs: Record<string, unknown> = {};
  const childMembers = members.filter((member) => member.id !== root.id);
  const attrKeys = new Set(
    members.flatMap((member) => Object.keys(member.attrs as Record<string, unknown>)),
  );
  for (const key of attrKeys) {
    const fieldPath = `attrs.${key}`;
    const rootHasValue = Object.hasOwn(rootAttrs, key);
    const rootValue = rootAttrs[key];
    const lockedChild = childMembers.find((member) => {
      const memberAttrs = member.attrs as Record<string, unknown>;
      return member.lockedFields.includes(fieldPath) && Object.hasOwn(memberAttrs, key);
    });
    if (root.lockedFields.includes(fieldPath) && rootHasValue) {
      attrs[key] = rootValue;
    } else if (lockedChild) {
      attrs[key] = (lockedChild.attrs as Record<string, unknown>)[key];
    } else if (rootHasValue && Array.isArray(rootValue)) {
      attrs[key] = [
        ...new Set([
          ...childMembers.flatMap((member) => {
            const value = (member.attrs as Record<string, unknown>)[key];
            return Array.isArray(value) ? value : [];
          }),
          ...rootValue,
        ]),
      ];
    } else if (rootHasValue) {
      attrs[key] = rootValue;
    } else {
      const firstChild = childMembers.find((member) =>
        Object.hasOwn(member.attrs as Record<string, unknown>, key),
      );
      const value = firstChild && (firstChild.attrs as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        attrs[key] = [
          ...new Set(
            childMembers.flatMap((member) => {
              const memberValue = (member.attrs as Record<string, unknown>)[key];
              return Array.isArray(memberValue) ? memberValue : [];
            }),
          ),
        ];
      } else if (firstChild) {
        attrs[key] = value;
      }
    }
  }
  const lockedChildName = childMembers.find((member) =>
    member.lockedFields.includes("displayName"),
  );
  const displayName =
    root.lockedFields.includes("displayName") || !lockedChildName
      ? root.displayName
      : lockedChildName.displayName;
  return {
    displayName,
    normalizedName: normalizeCompanyName(displayName),
    attrs,
    lockedFields: [...new Set(members.flatMap((member) => member.lockedFields))],
  };
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateValue(value: CompanyPartialDate | null | undefined): Date | null {
  return value ? new Date(`${value.date}T00:00:00.000Z`) : null;
}

function datePrecision(value: CompanyPartialDate | null | undefined): string | null {
  return value?.precision ?? null;
}

function partialDate(value: Date | null, precision: string | null): CompanyPartialDate | null {
  if (!value || !precision) return null;
  return {
    date: value.toISOString().slice(0, 10),
    precision: precision as CompanyPartialDate["precision"],
  };
}

function identityParts(input: CompanyEntityImportInput["entity"]): Array<[string, string, string]> {
  return [
    ...new Map(
      companyEntityIdentifiers(input).map((value) => {
        const separator = value.indexOf(":");
        const part: [string, string, string] = [
          input.kind,
          value.slice(0, separator),
          value.slice(separator + 1),
        ];
        return [JSON.stringify(part), part] as const;
      }),
    ).values(),
  ];
}

function identityPartsFor(
  kind: string,
  displayName: string,
  attrs: Record<string, unknown>,
): Array<[string, string, string]> {
  return identityParts({
    kind,
    displayName,
    attrs,
    confidence: 0,
  } as CompanyEntityImportInput["entity"]);
}

function identityFieldPath(identityType: string): string {
  if (identityType === "name") return "displayName";
  const attr = {
    email: "workEmails",
    slack: "slackId",
    github: "githubLogin",
    linear: "linearId",
    domain: "domain",
  }[identityType];
  return attr ? `attrs.${attr}` : `attrs.${identityType}`;
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
  connectionId: string | null;
  mcpServerId: string | null;
  dataRoomItemId: string | null;
  sourceItemId: string;
  sourceKey: string;
  sourceUrl: string | null;
  quote: string;
  contentHash: string;
  extractedAt: Date;
  extractorRunId: string | null;
  extractorModel: Prisma.JsonValue | null;
  confidence: number;
  confirmedByUserId: string | null;
  confirmedAt: Date | null;
}): CompanyEvidenceRecord {
  return {
    id: row.id,
    factKind: row.factKind as CompanyEvidenceRecord["factKind"],
    factId: row.factId,
    stance: row.stance as CompanyEvidenceRecord["stance"],
    sourceKind: row.sourceKind as CompanyEvidenceRecord["sourceKind"],
    connectionId: row.connectionId,
    mcpServerId: row.mcpServerId,
    dataRoomItemId: row.dataRoomItemId,
    sourceItemId: row.sourceItemId,
    sourceKey: row.sourceKey,
    sourceUrl: row.sourceUrl,
    quote: row.quote,
    contentHash: row.contentHash,
    extractedAt: row.extractedAt.toISOString(),
    extractorRunId: row.extractorRunId,
    extractorModel:
      row.extractorModel &&
      typeof row.extractorModel === "object" &&
      !Array.isArray(row.extractorModel)
        ? (row.extractorModel as Record<string, unknown>)
        : null,
    confidence: row.confidence,
    confirmedByUserId: row.confirmedByUserId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
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

async function mapEdgeRecord(
  db: CompanyDb,
  scope: Scope,
  row: Prisma.CompanyEdgeGetPayload<object>,
): Promise<CompanyEdgeRecord> {
  return {
    id: row.id,
    fromId: row.fromId,
    toId: row.toId,
    relation: row.relation as CompanyEdgeRecord["relation"],
    startsOn: partialDate(row.startsOn, row.startsPrecision),
    endsOn: partialDate(row.endsOn, row.endsPrecision),
    role: row.role,
    confidence: row.confidence,
    status: row.status as CompanyEdgeRecord["status"],
    visibility: row.visibility as CompanyEdgeRecord["visibility"],
    lockedFields: row.lockedFields,
    confirmedByUserId: row.confirmedByUserId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    evidence: await evidenceFor(db, scope, "edge", row.id),
  };
}

async function mapEventRecord(
  db: CompanyDb,
  scope: Scope,
  row: Prisma.CompanyEventGetPayload<object>,
  entityIds: string[],
): Promise<CompanyEventRecord> {
  return {
    id: row.id,
    stream: row.stream as CompanyEventRecord["stream"],
    kind: row.kind as CompanyEventRecord["kind"],
    title: row.title,
    occursOn: partialDate(row.occursOn, row.occursPrecision),
    endsOn: partialDate(row.endsOn, row.endsPrecision),
    amountCents: row.amountCents === null ? null : Number(row.amountCents),
    currency: row.currency,
    entityIds,
    confidence: row.confidence,
    status: row.status as CompanyEventRecord["status"],
    visibility: row.visibility as CompanyEventRecord["visibility"],
    lockedFields: row.lockedFields,
    confirmedByUserId: row.confirmedByUserId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    evidence: await evidenceFor(db, scope, "event", row.id),
  };
}

async function mapEntity(
  db: CompanyDb,
  scope: Scope,
  row: Prisma.CompanyEntityGetPayload<{ include: typeof ENTITY_INCLUDE }>,
  options: { includeMerged?: boolean; includeRejected?: boolean } = {},
): Promise<CompanyEntityRecord> {
  const parentMerge = await db.companyMerge.findFirst({
    where: { ...scope, sourceEntityId: row.id },
    select: { survivorEntityId: true },
  });
  if (parentMerge && !options.includeMerged) {
    const survivor = await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: parentMerge.survivorEntityId },
      include: ENTITY_INCLUDE,
    });
    return mapEntity(db, scope, survivor, options);
  }
  const merges = await db.companyMerge.findMany({
    where: { ...scope, survivorEntityId: row.id },
    select: { sourceEntityId: true },
    orderBy: { createdAt: "asc" },
  });
  const memberIds = [row.id, ...merges.map((merge) => merge.sourceEntityId)];
  const members = await db.companyEntity.findMany({
    where: { ...scope, id: { in: memberIds } },
    orderBy: { id: "asc" },
  });
  const memberIdentities = await db.companyIdentity.findMany({
    where: { ...scope, entityId: { in: memberIds } },
    select: { id: true, identityType: true, identityValue: true },
    orderBy: [{ identityType: "asc" }, { identityValue: "asc" }],
  });
  const composed = composeEntityGroup(row, members);
  const rootLinks = {
    contactId: row.contactId,
    legalContractId: row.legalContractId,
    dataRoomItemId: row.dataRoomItemId,
  };
  const childLinks = members.find((member) => member.id !== row.id);
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
  const linkedEntityIds = [
    ...new Set([
      ...edgeRows.flatMap((edge) => [edge.fromId, edge.toId]),
      ...eventEntityRows.map((link) => link.entityId),
    ]),
  ];
  const rejectedEntityIds = new Set(
    (
      await db.companyEntity.findMany({
        where: { ...scope, id: { in: linkedEntityIds }, status: "rejected" },
        select: { id: true },
      })
    ).map((entity) => entity.id),
  );
  const edges = await Promise.all(
    edgeRows
      .filter(
        (edge) =>
          options.includeRejected ||
          (edge.status !== "rejected" &&
            !rejectedEntityIds.has(edge.fromId) &&
            !rejectedEntityIds.has(edge.toId)),
      )
      .map(async (edge) => ({
        ...(await mapEdgeRecord(db, scope, edge)),
        fromId: await resolveSurvivor(edge.fromId),
        toId: await resolveSurvivor(edge.toId),
      })),
  );
  const uniqueEventLinks = [
    ...new Map(eventRows.map((link) => [link.eventId, link])).values(),
  ].filter(
    (link) =>
      options.includeRejected ||
      (link.event.status !== "rejected" &&
        !eventEntityRows.some(
          (eventLink) =>
            eventLink.eventId === link.eventId && rejectedEntityIds.has(eventLink.entityId),
        )),
  );
  const events = await Promise.all(
    uniqueEventLinks.map(async (link) =>
      mapEventRecord(db, scope, link.event, [
        ...new Set(
          await Promise.all(
            eventEntityRows
              .filter((eventLink) => eventLink.eventId === link.eventId)
              .map((eventLink) => resolveSurvivor(eventLink.entityId)),
          ),
        ),
      ]),
    ),
  );
  return {
    id: row.id,
    kind: CompanyEntityKindSchema.parse(row.kind),
    displayName: composed.displayName,
    normalizedName: composed.normalizedName,
    attrs: composed.attrs,
    confidence: row.confidence,
    status: CompanyStatusSchema.parse(row.status),
    visibility: CompanyVisibilitySchema.parse(row.visibility),
    lockedFields: composed.lockedFields,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    confirmedByUserId: row.confirmedByUserId,
    identities: memberIdentities.map((identity) => ({
      ...identity,
      identityType: CompanyIdentityTypeSchema.parse(identity.identityType),
    })),
    evidence: (
      await Promise.all(memberIds.map((entityId) => evidenceFor(db, scope, "entity", entityId)))
    ).flat(),
    mergedFrom: merges.map((merge) => merge.sourceEntityId),
    edges,
    events,
    contactId: rootLinks.contactId ?? childLinks?.contactId ?? null,
    legalContractId: rootLinks.legalContractId ?? childLinks?.legalContractId ?? null,
    dataRoomItemId: rootLinks.dataRoomItemId ?? childLinks?.dataRoomItemId ?? null,
  };
}

async function hiddenIds(db: CompanyDb, scope: Scope): Promise<Set<string>> {
  const rows = await db.companyMerge.findMany({
    where: scope,
    select: { sourceEntityId: true },
  });
  return new Set(rows.map((row) => row.sourceEntityId));
}

async function resolveSurvivorId(db: CompanyDb, scope: Scope, entityId: string): Promise<string> {
  const merge = await db.companyMerge.findFirst({
    where: { ...scope, sourceEntityId: entityId },
    select: { survivorEntityId: true },
  });
  return merge?.survivorEntityId ?? entityId;
}

async function canonicalEventEntityIds(
  db: CompanyDb,
  scope: Scope,
  entityIds: string[],
): Promise<string[]> {
  const uniqueIds = [...new Set(entityIds)];
  if (uniqueIds.length === 0) return [];
  const scopedEntities = await db.companyEntity.findMany({
    where: { ...scope, id: { in: uniqueIds } },
    select: { id: true },
  });
  if (scopedEntities.length !== uniqueIds.length) {
    throw new IsolationError("Event subjects must be scoped company entities");
  }
  return [
    ...new Set(
      await Promise.all(uniqueIds.map((entityId) => resolveSurvivorId(db, scope, entityId))),
    ),
  ].sort();
}

async function canonicalStoredEventEntityIds(
  db: CompanyDb,
  scope: Scope,
  entityIds: string[],
): Promise<string[]> {
  const uniqueIds = [...new Set(entityIds)];
  if (uniqueIds.length === 0) return [];
  const scopedEntities = await db.companyEntity.findMany({
    where: { ...scope, id: { in: uniqueIds } },
    select: { id: true },
  });
  const extantIds = new Set(scopedEntities.map((entity) => entity.id));
  return [
    ...new Set(
      await Promise.all(
        uniqueIds.map((entityId) =>
          extantIds.has(entityId) ? resolveSurvivorId(db, scope, entityId) : entityId,
        ),
      ),
    ),
  ].sort();
}

function entitySubjectKey(entityIds: string[]): string {
  return `entities:${JSON.stringify([...new Set(entityIds)].sort())}`;
}

async function canonicalEventSubjectKey(
  db: CompanyDb,
  scope: Scope,
  subjectKey: string,
): Promise<string> {
  if (!subjectKey.startsWith("entities:")) return subjectKey;
  let entityIds: unknown;
  try {
    entityIds = JSON.parse(subjectKey.slice("entities:".length));
  } catch {
    throw new IsolationError("Invalid stored event subject key");
  }
  if (!Array.isArray(entityIds) || !entityIds.every((id) => typeof id === "string")) {
    throw new IsolationError("Invalid stored event subject key");
  }
  return entitySubjectKey(await canonicalStoredEventEntityIds(db, scope, entityIds));
}

async function eventSubjectKeyForFingerprint(
  db: CompanyDb,
  scope: Scope,
  event: Pick<Prisma.CompanyEventGetPayload<object>, "id" | "subjectKey">,
): Promise<string> {
  if (event.subjectKey.startsWith("legacy:")) {
    const links = await db.companyEventEntity.findMany({
      where: { ...scope, eventId: event.id },
      select: { entityId: true },
    });
    if (links.length > 0) {
      return entitySubjectKey(
        await canonicalStoredEventEntityIds(
          db,
          scope,
          links.map((link) => link.entityId),
        ),
      );
    }
  }
  return canonicalEventSubjectKey(db, scope, event.subjectKey);
}

type EvidenceLocator = CompanyEntityImportInput["evidence"];

function sourceLocatorKey(evidence: EvidenceLocator): string {
  return `source:${hash([
    evidence.sourceKind,
    evidence.connectionId ?? "",
    evidence.mcpServerId ?? "",
    evidence.dataRoomItemId ?? (evidence.sourceKind === "data_room" ? evidence.sourceItemId : ""),
    evidence.sourceItemId,
  ])}`;
}

function sourceKey(evidence: EvidenceLocator, claimFingerprint: string): string {
  return `${sourceLocatorKey(evidence)}:claim:${claimFingerprint}`;
}

function sourceLocatorFromKey(value: string): string | null {
  const separator = value.lastIndexOf(":claim:");
  return separator < 0 ? null : value.slice(0, separator);
}

function claimFingerprintFromSourceKey(value: string): string | null {
  return value.match(/:claim:([a-f0-9]{64})$/)?.[1] ?? null;
}

async function eventSourceReplayIds(
  db: CompanyDb,
  scope: Scope,
  sourceKeys: string[],
): Promise<string[]> {
  if (sourceKeys.length === 0) return [];
  const [events, evidence] = await Promise.all([
    db.companyEvent.findMany({
      where: { ...scope, sourceClaimKeys: { hasSome: sourceKeys } },
      select: { id: true },
    }),
    db.companyEvidence.findMany({
      where: { ...scope, factKind: "event", sourceKey: { in: sourceKeys } },
      select: { factId: true },
    }),
  ]);
  const evidenceIds = [...new Set(evidence.map((item) => item.factId))];
  const legacyEvents = evidenceIds.length
    ? await db.companyEvent.findMany({
        where: { ...scope, id: { in: evidenceIds } },
        select: { id: true },
      })
    : [];
  return [
    ...new Set([...events.map((event) => event.id), ...legacyEvents.map((event) => event.id)]),
  ];
}

async function eventSourceClaimKeys(
  db: CompanyDb,
  scope: Scope,
  eventId: string,
  existing: string[],
): Promise<string[]> {
  const evidence = await db.companyEvidence.findMany({
    where: {
      ...scope,
      factKind: "event",
      factId: eventId,
      NOT: { sourceKind: "manual" },
    },
    select: { sourceKey: true },
  });
  return [...new Set([...existing, ...evidence.map((item) => item.sourceKey)])];
}

async function eventGlobalReplayIds(
  db: CompanyDb,
  scope: Scope,
  fingerprint: string,
): Promise<string[]> {
  const events = await db.companyEvent.findMany({
    where: { ...scope, claimFingerprints: { has: fingerprint } },
    select: { id: true },
  });
  return events.map((event) => event.id);
}

async function currentClaimFingerprints(
  db: CompanyDb,
  scope: Scope,
  factKind: "edge",
  factId: string,
  existing: string[],
  ...fingerprints: string[]
): Promise<string[]> {
  const evidence = await db.companyEvidence.findMany({
    where: { ...scope, factKind, factId },
    select: { sourceKey: true },
  });
  return [
    ...new Set([
      ...existing,
      ...fingerprints,
      ...evidence
        .map((item) => claimFingerprintFromSourceKey(item.sourceKey))
        .filter((item): item is string => item !== null),
    ]),
  ].sort();
}

async function findClaimReplayId(
  db: CompanyDb,
  scope: Scope,
  factKind: "edge",
  fingerprint: string,
): Promise<string | null> {
  const evidence = await db.companyEvidence.findMany({
    where: {
      ...scope,
      factKind,
      sourceKey: { endsWith: `:claim:${fingerprint}` },
    },
    select: { factId: true },
  });
  const rows =
    factKind === "edge"
      ? await db.companyEdge.findMany({
          where: { ...scope, claimFingerprints: { has: fingerprint } },
          select: { id: true },
        })
      : await db.companyEvent.findMany({
          where: { ...scope, claimFingerprints: { has: fingerprint } },
          select: { id: true },
        });
  const ids = new Set([...evidence.map((item) => item.factId), ...rows.map((item) => item.id)]);
  if (ids.size > 1) throw new IsolationError(`Ambiguous ${factKind} claim replay`);
  return ids.values().next().value ?? null;
}

async function findFactSuppression(
  db: CompanyDb,
  scope: Scope,
  factKind: "entity" | "edge" | "event",
  aliases: string[],
  entityKind: string | null = null,
): Promise<{ id: string } | null> {
  if (aliases.length === 0) return null;
  return db.companyRejection.findFirst({
    where: { ...scope, factKind, entityKind, identityAliases: { hasSome: aliases } },
    select: { id: true },
  });
}

async function findSuppression(
  db: CompanyDb,
  scope: Scope,
  entityKind: string,
  aliases: string[],
): Promise<{ id: string } | null> {
  return findFactSuppression(db, scope, "entity", aliases, entityKind);
}

function sourceLocatorWhere(locator: CompanySourceLocator) {
  if (locator.connectionId) {
    return { sourceKind: locator.sourceKind, connectionId: locator.connectionId };
  }
  if (locator.mcpServerId) {
    return { sourceKind: locator.sourceKind, mcpServerId: locator.mcpServerId };
  }
  return { sourceKind: locator.sourceKind };
}

async function assertSourceAllowed(db: CompanyDb, scope: Scope, evidence: EvidenceLocator) {
  if (evidence.sourceKind === "manual") return;
  const locator = {
    sourceKind: evidence.sourceKind as CompanySourceLocator["sourceKind"],
    connectionId: evidence.connectionId ?? null,
    mcpServerId: evidence.mcpServerId ?? null,
  };
  const exactKey = companyPrivacySourceKey(locator);
  const keys = [exactKey];
  if (evidence.sourceKind === "data_room") {
    const dataRoomItemId = await linkedDataRoomItemId(db, scope, evidence);
    if (dataRoomItemId) {
      const item = await db.dataRoomItem.findFirst({
        where: { id: dataRoomItemId, spaceId: scope.spaceId, userId: scope.ownerUserId },
        select: { sourceConnectionId: true },
      });
      if (item?.sourceConnectionId) {
        keys.push(
          companyPrivacySourceKey({
            sourceKind: "data_room",
            connectionId: item.sourceConnectionId,
            mcpServerId: null,
          }),
        );
      }
    }
  }
  const blocked = await db.companySourceBlock.findFirst({
    where: {
      ...scope,
      OR: [
        { sourceKey: { in: keys } },
        {
          sourceKind: evidence.sourceKind,
          connectionId: null,
          mcpServerId: null,
        },
      ],
    },
    select: { id: true },
  });
  if (blocked) throw new IsolationError("Company source is disconnected");
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
    connectionId: string | null;
    mcpServerId: string | null;
    dataRoomItemId: string | null;
    sourceItemId: string;
    sourceKey: string;
    quote: string;
    contentHash: string;
    importRunId?: string | null;
  },
): Promise<string> {
  const importRun = data.importRunId
    ? await db.companyImportRun.findFirst({
        where: { ...scope, id: data.importRunId },
        select: { id: true },
      })
    : null;
  const candidateData = {
    ...data,
    importRunId: importRun?.id ?? null,
    proposedFact: data.proposedFact as Prisma.InputJsonValue,
  };
  const existing = await db.companyCandidate.findFirst({
    where: { ...scope, kind: data.kind, reason: data.reason, sourceKey: data.sourceKey },
    select: { id: true, importRunId: true },
  });
  if (existing) {
    await db.companyCandidate.update({
      where: { id: existing.id },
      data: { ...candidateData, importRunId: existing.importRunId },
    });
    return existing.id;
  }
  const created = await db.companyCandidate.create({
    data: { ...scope, ...candidateData },
    select: { id: true },
  });
  return created.id;
}

function strongEntityAliases(input: CompanyEntityImportInput["entity"]): string[] {
  const identifiers = companyEntityIdentifiers(input).filter(
    (identifier) => !identifier.startsWith("name:"),
  );
  return identifiers.map((identifier) => `${input.kind}:${identifier}`);
}

function entityAliases(input: CompanyEntityImportInput["entity"], sourceKey: string): string[] {
  const strong = strongEntityAliases(input);
  if (input.kind === "person") {
    return [
      ...new Set([
        ...strong,
        ...companyExcludedPersonAliases(input as CompanyEntityInput),
        `source:${sourceKey}`,
      ]),
    ];
  }
  const aliases =
    strong.length > 0 ? strong : [`${input.kind}:name:${normalizeCompanyName(input.displayName)}`];
  return [...aliases, `source:${sourceKey}`];
}

async function linkedDataRoomItemId(
  db: CompanyDb,
  scope: Scope,
  evidence: EvidenceLocator,
): Promise<string | null> {
  if (evidence.sourceKind !== "data_room") return evidence.dataRoomItemId ?? null;
  const sourceId = evidence.dataRoomItemId ?? evidence.sourceItemId;
  const item = await db.dataRoomItem.findFirst({
    where: { id: sourceId, spaceId: scope.spaceId, userId: scope.ownerUserId },
    select: { id: true },
  });
  if (!item) throw new IsolationError("Data room evidence must reference a scoped item");
  return item.id;
}

async function evidenceCreateData(
  db: CompanyDb,
  scope: Scope,
  factKind: "entity" | "edge" | "event",
  factId: string,
  evidence: EvidenceLocator,
  claimFingerprint: string,
  stance = evidence.stance,
) {
  const dataRoomItemId = await linkedDataRoomItemId(db, scope, evidence);
  return {
    ...scope,
    factKind,
    factId,
    stance,
    sourceKind: evidence.sourceKind,
    connectionId: evidence.connectionId ?? null,
    mcpServerId: evidence.mcpServerId ?? null,
    dataRoomItemId,
    sourceItemId: evidence.sourceItemId,
    sourceKey: sourceKey({ ...evidence, dataRoomItemId }, claimFingerprint),
    sourceUrl: evidence.sourceUrl ?? null,
    quote: evidence.quote,
    contentHash: evidence.contentHash,
    extractedAt: new Date(evidence.extractedAt),
    extractorRunId: evidence.extractorRunId ?? null,
    extractorModel: evidence.extractorModel ?? Prisma.JsonNull,
    confidence: evidence.confidence,
    confirmedByUserId: null,
    confirmedAt: null,
  };
}

async function persistImportEvidence(
  db: CompanyDb,
  scope: Scope,
  data: Awaited<ReturnType<typeof evidenceCreateData>>,
) {
  await db.companyEvidence.createMany({ data: [data], skipDuplicates: true });
  const evidence = await db.companyEvidence.findFirst({
    where: {
      ...scope,
      factKind: data.factKind,
      factId: data.factId,
      sourceKey: data.sourceKey,
      contentHash: data.contentHash,
    },
    select: { id: true },
  });
  if (!evidence || !data.extractorRunId) return;
  const run = await db.companyImportRun.findFirst({
    where: { ...scope, id: data.extractorRunId },
    select: { id: true },
  });
  if (!run) return;
  await db.companyImportEvidence.createMany({
    data: [{ ...scope, runId: run.id, evidenceId: evidence.id }],
    skipDuplicates: true,
  });
}

async function importEntity(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEntityImportInput,
): Promise<CompanyWriteResult> {
  const input = CompanyEntityImportInputSchema.parse(raw);
  await assertSourceAllowed(db, scope, input.evidence);
  const identifiers = identityParts(input.entity);
  const strongIdentifiers = identifiers
    .filter(([, identityType]) => identityType !== "name")
    .map(([, identityType, identityValue]) => `${identityType}:${identityValue}`)
    .sort();
  const claimFingerprint = hash({
    entityKind: input.entity.kind,
    identity: strongIdentifiers.length
      ? strongIdentifiers
      : `name:${normalizeCompanyName(input.entity.displayName)}`,
    ...(input.entity.kind === "person" && strongIdentifiers.length === 0
      ? { claim: normalizeCompanyName(input.evidence.quote) }
      : {}),
  });
  const key = sourceKey(input.evidence, claimFingerprint);
  const importId = `company_${hash({ scope, input: input.entity, key }).slice(0, 24)}`;
  const aliases = entityAliases(input.entity, key);
  const evidenceRows = await db.companyEvidence.findMany({
    where: {
      ...scope,
      factKind: "entity",
      sourceKey: key,
    },
    select: { factId: true },
  });
  const evidenceEntities = evidenceRows.length
    ? await db.companyEntity.findMany({
        where: { ...scope, id: { in: evidenceRows.map((evidence) => evidence.factId) } },
        select: { id: true, status: true },
      })
    : [];
  const activeEvidence = evidenceRows.find((evidence) =>
    evidenceEntities.some(
      (entity) => entity.id === evidence.factId && entity.status !== "rejected",
    ),
  );
  const rejection = await findSuppression(db, scope, input.entity.kind, aliases);
  if (rejection) return { suppressed: true, record: null, rejectionId: rejection.id };

  const retainedClaim = activeEvidence
    ? null
    : await db.companyEntity.findFirst({
        where: {
          ...scope,
          kind: input.entity.kind,
          status: { not: "rejected" },
          OR: [{ sourceClaimKeys: { has: key } }, { id: importId }],
        },
        select: { id: true },
      });
  const existingEvidence = activeEvidence ?? (retainedClaim ? { factId: retainedClaim.id } : null);

  if (input.entity.kind === "person" && strongIdentifiers.length === 0 && !existingEvidence) {
    const sourceNameAlias = `person-source-name:${hash([
      sourceLocatorFromKey(key) ?? key,
      normalizeCompanyName(input.entity.displayName),
    ])}`;
    const stableRejection = await db.companyRejection.findFirst({
      where: {
        ...scope,
        factKind: "entity",
        entityKind: "person",
        identityAliases: { has: sourceNameAlias },
      },
      select: { id: true },
    });
    if (stableRejection) {
      const candidateId = await createCandidate(db, scope, {
        kind: "person",
        reason: "rejected_name_only_claim",
        entityIds: [],
        proposedFact: { entity: input.entity, rejectionId: stableRejection.id },
        sourceKind: input.evidence.sourceKind,
        connectionId: input.evidence.connectionId ?? null,
        mcpServerId: input.evidence.mcpServerId ?? null,
        dataRoomItemId: await linkedDataRoomItemId(db, scope, input.evidence),
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: key,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
        importRunId: input.evidence.extractorRunId ?? null,
      });
      return { deferred: true, record: null, candidateId };
    }
  }

  const matchingIdentifiers =
    input.entity.kind === "organisation"
      ? identifiers.filter(([, identityType]) => identityType !== "name")
      : identifiers;
  const matches = matchingIdentifiers.length
    ? await db.companyIdentity.findMany({
        where: {
          ...scope,
          entityKind: input.entity.kind,
          OR: matchingIdentifiers.map(([, identityType, identityValue]) => ({
            identityType,
            identityValue,
          })),
        },
        select: { entityId: true, identityType: true, identityValue: true },
      })
    : [];
  const matchedIds = [...new Set(matches.map((match) => match.entityId))];
  const groups = await Promise.all(
    matchedIds.map(async (matchedId) => {
      const merge = await db.companyMerge.findFirst({
        where: { ...scope, sourceEntityId: matchedId },
        select: { survivorEntityId: true },
      });
      return merge?.survivorEntityId ?? matchedId;
    }),
  );
  const matchedGroups = [...new Set(groups)];
  let entityId: string | undefined = existingEvidence?.factId;
  if (matchedGroups.length === 1) {
    entityId =
      identifiers
        .map(
          ([, identityType, identityValue]) =>
            matches.find(
              (match) =>
                match.identityType === identityType && match.identityValue === identityValue,
            )?.entityId,
        )
        .find((matchedId): matchedId is string => matchedId !== undefined) ?? matchedIds[0];
  } else if (matchedGroups.length > 1) {
    await createCandidate(db, scope, {
      kind: input.entity.kind,
      reason: "conflicting_strong_identities",
      entityIds: matchedGroups,
      proposedFact: input.entity,
      sourceKind: input.evidence.sourceKind,
      connectionId: input.evidence.connectionId ?? null,
      mcpServerId: input.evidence.mcpServerId ?? null,
      dataRoomItemId: await linkedDataRoomItemId(db, scope, input.evidence),
      sourceItemId: input.evidence.sourceItemId,
      sourceKey: key,
      quote: input.evidence.quote,
      contentHash: input.evidence.contentHash,
      importRunId: input.evidence.extractorRunId ?? null,
    });
  } else if (input.entity.kind === "company") {
    const company = await db.companyEntity.findFirst({
      where: { ...scope, kind: "company" },
      include: ENTITY_INCLUDE,
    });
    if (company) entityId = company.id;
  } else if (input.entity.kind === "organisation") {
    const normalizedName = normalizeCompanyName(input.entity.displayName);
    const sameName = await db.companyEntity.findMany({
      where: {
        ...scope,
        kind: "organisation",
        normalizedName,
      },
      include: ENTITY_INCLUDE,
    });
    const incomingDomain = input.entity.attrs.domain;
    const matchingDomains = incomingDomain
      ? sameName.filter(
          (existing) => (existing.attrs as { domain?: unknown }).domain === incomingDomain,
        )
      : [];
    const matchingDomain = matchingDomains[0];
    const domainlessMatches = sameName.filter(
      (existing) => !(existing.attrs as { domain?: unknown }).domain,
    );
    const domainlessMatch = domainlessMatches[0];
    if (incomingDomain && matchingDomains.length === 1 && matchingDomain) {
      entityId = matchingDomain.id;
    } else if (!incomingDomain && domainlessMatches.length === 1 && domainlessMatch) {
      entityId = domainlessMatch.id;
    } else if (sameName.length > 0) {
      await createCandidate(db, scope, {
        kind: "organisation",
        reason:
          incomingDomain && matchingDomains.length === 0
            ? "conflicting_organisation_domain"
            : "ambiguous_organisation_name",
        entityIds: sameName.map((existing) => existing.id),
        proposedFact: input.entity,
        sourceKind: input.evidence.sourceKind,
        connectionId: input.evidence.connectionId ?? null,
        mcpServerId: input.evidence.mcpServerId ?? null,
        dataRoomItemId: await linkedDataRoomItemId(db, scope, input.evidence),
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: key,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
        importRunId: input.evidence.extractorRunId ?? null,
      });
    }
  }

  if (!entityId && input.entity.kind === "person") {
    const normalizedName = normalizeCompanyName(input.entity.displayName);
    const sameName = await db.companyEntity.findMany({
      where: { ...scope, kind: "person", normalizedName },
      select: { id: true },
    });
    const localParts = identifiers
      .filter(([, identityType]) => identityType === "email")
      .map(([, , identityValue]) => identityValue.split("@", 1)[0]?.toLowerCase())
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
        connectionId: input.evidence.connectionId ?? null,
        mcpServerId: input.evidence.mcpServerId ?? null,
        dataRoomItemId: await linkedDataRoomItemId(db, scope, input.evidence),
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: key,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
        importRunId: input.evidence.extractorRunId ?? null,
      });
    }
  }

  if (entityId) {
    const originalEntityId = entityId;
    const existingEntity = await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: originalEntityId },
      select: { attrs: true, displayName: true, lockedFields: true, sourceClaimKeys: true },
    });
    const existingMerge = await db.companyMerge.findFirst({
      where: { ...scope, sourceEntityId: originalEntityId },
      select: { survivorEntityId: true },
    });
    const survivorEntityId =
      (matchedGroups.length === 1 ? matchedGroups[0] : undefined) ??
      existingMerge?.survivorEntityId ??
      originalEntityId;
    const mergedChildren = await db.companyMerge.findMany({
      where: { ...scope, survivorEntityId },
      select: { sourceEntityId: true },
    });
    const groupMembers = await db.companyEntity.findMany({
      where: {
        ...scope,
        id: {
          in: [survivorEntityId, ...mergedChildren.map((merge) => merge.sourceEntityId)],
        },
      },
      select: { id: true, displayName: true, attrs: true, lockedFields: true },
      orderBy: { id: "asc" },
    });
    const survivorEntity = groupMembers.find((member) => member.id === survivorEntityId);
    if (!survivorEntity) throw new IsolationError("Merged entity root not found");
    const effectiveEntity = composeEntityGroup(survivorEntity, groupMembers);
    const contradictsLockedValue =
      (effectiveEntity.lockedFields.includes("displayName") &&
        effectiveEntity.displayName !== input.entity.displayName) ||
      Object.entries(input.entity.attrs).some(([key, value]) => {
        return (
          effectiveEntity.lockedFields.includes(`attrs.${key}`) &&
          JSON.stringify(effectiveEntity.attrs[key]) !== JSON.stringify(value)
        );
      });
    const replayEvidence = await evidenceCreateData(
      db,
      scope,
      "entity",
      originalEntityId,
      input.evidence,
      claimFingerprint,
      contradictsLockedValue ? "contradicts" : input.evidence.stance,
    );
    await persistImportEvidence(db, scope, replayEvidence);
    if (contradictsLockedValue) {
      await db.companyEvidence.updateMany({
        where: {
          ...scope,
          factKind: "entity",
          factId: originalEntityId,
          sourceKey: replayEvidence.sourceKey,
          contentHash: replayEvidence.contentHash,
        },
        data: { stance: "contradicts" },
      });
    }
    const currentAttrs = existingEntity.attrs as Record<string, unknown>;
    const updatedAttrs = { ...currentAttrs };
    for (const [key, value] of Object.entries(input.entity.attrs)) {
      if (existingEntity.lockedFields.includes(`attrs.${key}`)) continue;
      updatedAttrs[key] = value;
    }
    const displayName = existingEntity.lockedFields.includes("displayName")
      ? existingEntity.displayName
      : input.entity.displayName;
    await db.companyEntity.update({
      where: { id: originalEntityId },
      data: {
        displayName,
        normalizedName: normalizeCompanyName(displayName),
        attrs: updatedAttrs as Prisma.InputJsonValue,
        confidence: input.entity.confidence,
        sourceClaimKeys: [...new Set([...existingEntity.sourceClaimKeys, key])],
      },
    });
    const persistedIdentifiers = identifiers.filter(([, identityType, identityValue]) => {
      const fieldPath = identityFieldPath(identityType);
      if (!effectiveEntity.lockedFields.includes(fieldPath)) return true;
      const lockedValue =
        fieldPath === "displayName"
          ? effectiveEntity.displayName
          : effectiveEntity.attrs[fieldPath.slice("attrs.".length)];
      if (identityType === "name") {
        return normalizeCompanyName(String(lockedValue ?? "")) === identityValue;
      }
      return Array.isArray(lockedValue)
        ? lockedValue.includes(identityValue)
        : lockedValue === identityValue;
    });
    if (persistedIdentifiers.length > 0 && matchedGroups.length <= 1) {
      await db.companyIdentity.createMany({
        data: persistedIdentifiers.map(([entityKind, identityType, identityValue]) => ({
          ...scope,
          entityId: originalEntityId,
          entityKind,
          identityType,
          identityValue,
        })),
        skipDuplicates: true,
      });
    }
    const row = await db.companyEntity.findFirstOrThrow({
      where: { ...scope, id: originalEntityId },
      include: ENTITY_INCLUDE,
    });
    return mapEntity(db, scope, row);
  }

  const id = importId;
  const row = await db.companyEntity.create({
    data: {
      id,
      ...scope,
      kind: input.entity.kind,
      displayName: input.entity.displayName,
      normalizedName: normalizeCompanyName(input.entity.displayName),
      attrs: input.entity.attrs as Prisma.InputJsonValue,
      confidence: input.entity.confidence,
      sourceClaimKeys: [key],
      contactId: input.entity.contactId ?? null,
      legalContractId: input.entity.legalContractId ?? null,
      dataRoomItemId: input.entity.dataRoomItemId ?? null,
    },
    include: ENTITY_INCLUDE,
  });
  await persistImportEvidence(
    db,
    scope,
    await evidenceCreateData(db, scope, "entity", row.id, input.evidence, claimFingerprint),
  );
  if (matchedGroups.length > 1) {
    // Conflicting identifiers remain candidates; none is attached to the new entity.
    return mapEntity(db, scope, row);
  }
  if (identifiers.length > 0 && matchedGroups.length <= 1) {
    await db.companyIdentity.createMany({
      data: identifiers.map(([entityKind, identityType, identityValue]) => ({
        ...scope,
        entityId: row.id,
        entityKind,
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
): Promise<CompanyEdgeRecord | CompanySuppressedResult> {
  const input = CompanyEdgeImportInputSchema.parse(raw);
  await assertSourceAllowed(db, scope, input.evidence);
  const startsOn = dateValue(input.edge.startsOn);
  const endsOn = dateValue(input.edge.endsOn);
  const fingerprint = hash({
    relation: input.edge.relation,
    fromId: input.edge.fromId,
    toId: input.edge.toId,
    startsOn: input.edge.startsOn ?? null,
    endsOn: input.edge.endsOn ?? null,
    role: input.edge.role ?? null,
  });
  const key = sourceKey(input.evidence, fingerprint);
  const rejection = await findFactSuppression(db, scope, "edge", [
    `edge:${fingerprint}`,
    `source:${key}`,
  ]);
  if (rejection) return { suppressed: true, record: null, rejectionId: rejection.id };
  const replayId = await findClaimReplayId(db, scope, "edge", fingerprint);
  const replay =
    replayId === null
      ? null
      : await db.companyEdge.findFirst({ where: { ...scope, id: replayId } });
  if (replay?.status === "rejected") throw new IsolationError("Rejected edges cannot be replayed");
  const edge =
    replay ??
    (await db.companyEdge.findFirst({
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
    }));
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
        claimFingerprints: [fingerprint],
      },
    }));
  const contradicts =
    (row.lockedFields.includes("fromId") && row.fromId !== input.edge.fromId) ||
    (row.lockedFields.includes("toId") && row.toId !== input.edge.toId) ||
    (row.lockedFields.includes("relation") && row.relation !== input.edge.relation) ||
    (row.lockedFields.includes("startsOn") &&
      JSON.stringify(partialDate(row.startsOn, row.startsPrecision)) !==
        JSON.stringify(input.edge.startsOn ?? null)) ||
    (row.lockedFields.includes("endsOn") &&
      JSON.stringify(partialDate(row.endsOn, row.endsPrecision)) !==
        JSON.stringify(input.edge.endsOn ?? null)) ||
    (row.lockedFields.includes("role") && row.role !== (input.edge.role ?? null)) ||
    (row.lockedFields.includes("confidence") && row.confidence !== input.edge.confidence);
  const claimFingerprints = await currentClaimFingerprints(
    db,
    scope,
    "edge",
    row.id,
    row.claimFingerprints,
    edgeClaimFingerprint(row),
    fingerprint,
  );
  const updateData: Prisma.CompanyEdgeUncheckedUpdateInput = { claimFingerprints };
  if (!row.lockedFields.includes("fromId")) updateData.fromId = input.edge.fromId;
  if (!row.lockedFields.includes("toId")) updateData.toId = input.edge.toId;
  if (!row.lockedFields.includes("relation")) updateData.relation = input.edge.relation;
  if (!row.lockedFields.includes("startsOn")) {
    updateData.startsOn = startsOn;
    updateData.startsPrecision = datePrecision(input.edge.startsOn);
  }
  if (!row.lockedFields.includes("endsOn")) {
    updateData.endsOn = endsOn;
    updateData.endsPrecision = datePrecision(input.edge.endsOn);
  }
  if (!row.lockedFields.includes("role")) updateData.role = input.edge.role ?? null;
  if (!row.lockedFields.includes("confidence")) updateData.confidence = input.edge.confidence;
  const updated = await db.companyEdge.update({
    where: { id: row.id },
    data: updateData,
  });
  const edgeEvidence = await evidenceCreateData(
    db,
    scope,
    "edge",
    row.id,
    input.evidence,
    fingerprint,
    contradicts ? "contradicts" : input.evidence.stance,
  );
  await persistImportEvidence(db, scope, edgeEvidence);
  if (contradicts) {
    await db.companyEvidence.updateMany({
      where: {
        ...scope,
        factKind: "edge",
        factId: row.id,
        sourceKey: edgeEvidence.sourceKey,
        contentHash: edgeEvidence.contentHash,
      },
      data: { stance: "contradicts" },
    });
  }
  return mapEdgeRecord(db, scope, updated);
}

async function importEvent(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEventImportInput,
): Promise<CompanyEventRecord | CompanySuppressedResult | CompanyDeferredResult> {
  const input = CompanyEventImportInputSchema.parse(raw);
  await assertSourceAllowed(db, scope, input.evidence);
  const normalizedTitle = normalizeCompanyName(input.event.title);
  const canonicalEntityIds = await canonicalEventEntityIds(db, scope, input.event.entityIds);
  const subjectKey =
    canonicalEntityIds.length > 0
      ? entitySubjectKey(canonicalEntityIds)
      : sourceLocatorKey(input.evidence);
  const rawSubjectKey =
    input.event.entityIds.length > 0
      ? entitySubjectKey([...new Set(input.event.entityIds)].sort())
      : subjectKey;
  const fingerprint = eventClaimFingerprint({
    kind: input.event.kind,
    normalizedTitle,
    occursOn: dateValue(input.event.occursOn),
    occursPrecision: datePrecision(input.event.occursOn),
    subjectKey,
  });
  const rawFingerprint = eventClaimFingerprint({
    kind: input.event.kind,
    normalizedTitle,
    occursOn: dateValue(input.event.occursOn),
    occursPrecision: datePrecision(input.event.occursOn),
    subjectKey: rawSubjectKey,
  });
  const key = sourceKey(input.evidence, fingerprint);
  const rawKey = sourceKey(input.evidence, rawFingerprint);
  const assertedSourceKey = rawKey === key ? key : rawKey;
  const rejection = await findFactSuppression(db, scope, "event", [
    `event:${fingerprint}`,
    `source:${assertedSourceKey}`,
  ]);
  if (rejection) return { suppressed: true, record: null, rejectionId: rejection.id };
  const exactSourceReplayIds = await eventSourceReplayIds(db, scope, [rawKey]);
  let event =
    exactSourceReplayIds.length === 1
      ? await db.companyEvent.findFirst({
          where: { ...scope, id: exactSourceReplayIds[0] },
        })
      : null;
  if (!event) {
    const candidates = await db.companyEvent.findMany({
      where: {
        ...scope,
        kind: input.event.kind,
        normalizedTitle,
        occursOn: dateValue(input.event.occursOn),
        occursPrecision: datePrecision(input.event.occursOn),
      },
    });
    const matchingCandidates: typeof candidates = [];
    for (const candidate of candidates) {
      const savedSubjectKey = await canonicalEventSubjectKey(db, scope, candidate.subjectKey);
      let matchesSubject = savedSubjectKey === subjectKey;
      if (!matchesSubject && subjectKey.startsWith("entities:")) {
        const links = await db.companyEventEntity.findMany({
          where: { ...scope, eventId: candidate.id },
          select: { entityId: true },
        });
        const linkedSubjectKey = entitySubjectKey(
          await canonicalStoredEventEntityIds(
            db,
            scope,
            links.map((link) => link.entityId),
          ),
        );
        matchesSubject = linkedSubjectKey === subjectKey;
      }
      if (matchesSubject) matchingCandidates.push(candidate);
    }
    const matchingIds = [
      ...new Set([
        ...(exactSourceReplayIds.length > 1 ? exactSourceReplayIds : []),
        ...(await eventGlobalReplayIds(db, scope, fingerprint)),
        ...matchingCandidates.map((candidate) => candidate.id),
      ]),
    ];
    if (matchingIds.length > 1) {
      const candidateId = await createCandidate(db, scope, {
        kind: "event",
        reason: "ambiguous_event_subjects",
        entityIds: canonicalEntityIds,
        proposedFact: {
          event: input.event,
          matchingEventIds: matchingIds.sort(),
        },
        sourceKind: input.evidence.sourceKind,
        connectionId: input.evidence.connectionId ?? null,
        mcpServerId: input.evidence.mcpServerId ?? null,
        dataRoomItemId: await linkedDataRoomItemId(db, scope, input.evidence),
        sourceItemId: input.evidence.sourceItemId,
        sourceKey: assertedSourceKey,
        quote: input.evidence.quote,
        contentHash: input.evidence.contentHash,
        importRunId: input.evidence.extractorRunId ?? null,
      });
      return { deferred: true, record: null, candidateId };
    }
    const eventId = matchingIds[0];
    event =
      eventId === undefined
        ? null
        : (matchingCandidates.find((candidate) => candidate.id === eventId) ??
          (await db.companyEvent.findFirst({ where: { ...scope, id: eventId } })));
  }
  if (event?.status === "rejected") throw new IsolationError("Rejected events cannot be replayed");
  const row =
    event ??
    (await db.companyEvent.create({
      data: {
        ...scope,
        stream: input.event.stream,
        kind: input.event.kind,
        title: input.event.title,
        normalizedTitle,
        subjectKey,
        occursOn: dateValue(input.event.occursOn),
        occursPrecision: input.event.occursOn?.precision ?? null,
        endsOn: dateValue(input.event.endsOn),
        endsPrecision: datePrecision(input.event.endsOn),
        amountCents: input.event.amountCents ?? null,
        currency: input.event.currency ?? null,
        confidence: input.event.confidence,
        claimFingerprints: [fingerprint],
        sourceClaimKeys: [assertedSourceKey],
      },
    }));
  const linksBefore = await db.companyEventEntity.findMany({
    where: { ...scope, eventId: row.id },
    select: { entityId: true },
  });
  const existingEntityIds = linksBefore.map((link) => link.entityId);
  const entityIdsLocked = row.lockedFields.includes("entityIds");
  const incomingEntityIds = new Set(canonicalEntityIds);
  const existingEntityIdSet = new Set(await canonicalEventEntityIds(db, scope, existingEntityIds));
  const entityIdsMatch =
    incomingEntityIds.size === existingEntityIdSet.size &&
    [...incomingEntityIds].every((entityId) => existingEntityIdSet.has(entityId));
  const contradictsEntityIds = entityIdsLocked && !entityIdsMatch;
  const amountCurrencyLocked =
    row.lockedFields.includes("amountCents") || row.lockedFields.includes("currency");
  const amountCurrencyChanged =
    (row.amountCents === null ? null : Number(row.amountCents)) !==
      (input.event.amountCents ?? null) || row.currency !== (input.event.currency ?? null);
  const contradicts =
    (row.lockedFields.includes("stream") && row.stream !== input.event.stream) ||
    (row.lockedFields.includes("kind") && row.kind !== input.event.kind) ||
    (row.lockedFields.includes("title") && row.title !== input.event.title) ||
    (row.lockedFields.includes("occursOn") &&
      JSON.stringify(partialDate(row.occursOn, row.occursPrecision)) !==
        JSON.stringify(input.event.occursOn ?? null)) ||
    (row.lockedFields.includes("endsOn") &&
      JSON.stringify(partialDate(row.endsOn, row.endsPrecision)) !==
        JSON.stringify(input.event.endsOn ?? null)) ||
    (amountCurrencyLocked && amountCurrencyChanged) ||
    (row.lockedFields.includes("confidence") && row.confidence !== input.event.confidence) ||
    contradictsEntityIds;
  const currentSubjectKey = await eventSubjectKeyForFingerprint(db, scope, row);
  const currentFingerprint = eventClaimFingerprint({ ...row, subjectKey: currentSubjectKey });
  const claimFingerprints = [
    ...new Set([
      ...row.claimFingerprints,
      currentFingerprint,
      ...(currentSubjectKey === subjectKey ? [fingerprint] : []),
    ]),
  ];
  const sourceClaimKeys = [
    ...new Set([
      ...(await eventSourceClaimKeys(db, scope, row.id, row.sourceClaimKeys)),
      assertedSourceKey,
    ]),
  ];
  const updateData: Prisma.CompanyEventUpdateInput = {
    claimFingerprints,
    sourceClaimKeys,
  };
  if (!row.lockedFields.includes("stream")) updateData.stream = input.event.stream;
  if (!row.lockedFields.includes("kind")) updateData.kind = input.event.kind;
  if (!row.lockedFields.includes("title")) {
    updateData.title = input.event.title;
    updateData.normalizedTitle = normalizedTitle;
  }
  if (!row.lockedFields.includes("occursOn")) {
    updateData.occursOn = dateValue(input.event.occursOn);
    updateData.occursPrecision = datePrecision(input.event.occursOn);
  }
  if (!row.lockedFields.includes("endsOn")) {
    updateData.endsOn = dateValue(input.event.endsOn);
    updateData.endsPrecision = datePrecision(input.event.endsOn);
  }
  if (!row.lockedFields.includes("amountCents") && !row.lockedFields.includes("currency")) {
    updateData.amountCents = input.event.amountCents ?? null;
    updateData.currency = input.event.currency ?? null;
  }
  if (!row.lockedFields.includes("confidence")) updateData.confidence = input.event.confidence;
  await db.companyEvent.update({
    where: { id: row.id },
    data: updateData,
  });
  if (!entityIdsLocked) {
    await db.companyEventEntity.createMany({
      data: input.event.entityIds.map((entityId) => ({ ...scope, eventId: row.id, entityId })),
      skipDuplicates: true,
    });
  }
  const eventEvidence = await evidenceCreateData(
    db,
    scope,
    "event",
    row.id,
    input.evidence,
    rawKey === key ? fingerprint : rawFingerprint,
    contradicts ? "contradicts" : input.evidence.stance,
  );
  await persistImportEvidence(db, scope, eventEvidence);
  if (contradicts) {
    await db.companyEvidence.updateMany({
      where: {
        ...scope,
        factKind: "event",
        factId: row.id,
        sourceKey: eventEvidence.sourceKey,
        contentHash: eventEvidence.contentHash,
      },
      data: { stance: "contradicts" },
    });
  }
  const links = await db.companyEventEntity.findMany({
    where: { ...scope, eventId: row.id },
    select: { entityId: true },
  });
  const finalEvent = await db.companyEvent.findFirstOrThrow({
    where: { ...scope, id: row.id },
  });
  return mapEventRecord(
    db,
    scope,
    finalEvent,
    links.map((link) => link.entityId),
  );
}

function touchedFields(input: CompanyEntityEditInput): Array<[string, unknown]> {
  const fields: Array<[string, unknown]> = [];
  if (input.displayName !== undefined) fields.push(["displayName", input.displayName]);
  for (const [key, value] of Object.entries(input.attrs ?? {})) {
    fields.push([`attrs.${key}`, value]);
  }
  return fields;
}

async function manualEvidence(
  db: CompanyDb,
  scope: Scope,
  factKind: "entity" | "edge" | "event",
  entityId: string,
  fieldPath: string,
  value: unknown,
  confirmedByUserId?: string,
): Promise<string> {
  const confirmedAt = confirmedByUserId ? new Date() : null;
  const contentHash = hash({ factKind, entityId, fieldPath, value, confirmedAt });
  const sourceKey = confirmedByUserId
    ? `manual:${factKind}:${entityId}:${fieldPath}:${confirmedAt!.getTime()}`
    : `manual:${factKind}:${entityId}:${fieldPath}`;
  const row = await db.companyEvidence.upsert({
    where: {
      spaceId_ownerUserId_factKind_factId_sourceKey_contentHash: {
        ...scope,
        factKind,
        factId: entityId,
        sourceKey,
        contentHash,
      },
    },
    create: {
      ...scope,
      factKind,
      factId: entityId,
      stance: "supports",
      sourceKind: "manual",
      sourceItemId: `manual:${entityId}`,
      sourceKey,
      quote: `Owner correction for ${fieldPath}`,
      contentHash,
      extractedAt: new Date(),
      extractorModel: Prisma.JsonNull,
      confidence: 1,
      confirmedByUserId: confirmedByUserId ?? null,
      confirmedAt,
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
  if (row.status === "rejected") throw new IsolationError("Rejected entities cannot be edited");
  if (row.kind !== input.kind) throw new IsolationError("Entity kind does not match edit");
  const updates = touchedFields(input);
  const currentAttrs = row.attrs as Record<string, unknown>;
  const attrs = { ...currentAttrs, ...(input.attrs ?? {}) };
  const displayName = input.displayName ?? row.displayName;
  const previousIdentityParts = identityPartsFor(row.kind, row.displayName, currentAttrs);
  const nextIdentityParts = identityPartsFor(row.kind, displayName, attrs);
  const previousIdentityValues = new Map<string, string[]>();
  const nextIdentityValues = new Map<string, string[]>();
  for (const [, identityType, identityValue] of previousIdentityParts) {
    previousIdentityValues.set(identityType, [
      ...(previousIdentityValues.get(identityType) ?? []),
      identityValue,
    ]);
  }
  for (const [, identityType, identityValue] of nextIdentityParts) {
    nextIdentityValues.set(identityType, [
      ...(nextIdentityValues.get(identityType) ?? []),
      identityValue,
    ]);
  }
  const identityTypes = new Set([...previousIdentityValues.keys(), ...nextIdentityValues.keys()]);
  const changedIdentityTypes = new Set(
    [...identityTypes].filter(
      (identityType) =>
        JSON.stringify(previousIdentityValues.get(identityType) ?? []) !==
        JSON.stringify(nextIdentityValues.get(identityType) ?? []),
    ),
  );
  const touchedIdentityTypes = new Map<string, string>();
  for (const [path] of updates) {
    if (path === "displayName") {
      if (previousIdentityValues.has("name") || nextIdentityValues.has("name")) {
        touchedIdentityTypes.set("name", path);
      }
      continue;
    }
    const identityType = {
      "attrs.workEmails": "email",
      "attrs.slackId": "slack",
      "attrs.githubLogin": "github",
      "attrs.linearId": "linear",
      "attrs.domain": "domain",
    }[path];
    if (identityType) touchedIdentityTypes.set(identityType, path);
  }
  for (const identityType of touchedIdentityTypes.keys()) {
    changedIdentityTypes.add(identityType);
  }
  const nextChangedIdentities = nextIdentityParts
    .filter(([, identityType]) => changedIdentityTypes.has(identityType))
    .map(([, identityType, identityValue]) => ({ identityType, identityValue }));
  if (nextChangedIdentities.length > 0) {
    const collisions = await db.companyIdentity.findMany({
      where: {
        ...scope,
        entityKind: row.kind,
        entityId: { not: row.id },
        OR: nextChangedIdentities.map(({ identityType, identityValue }) => ({
          identityType,
          identityValue,
        })),
      },
      select: { identityType: true, identityValue: true },
    });
    if (collisions.length > 0) {
      const collision = collisions[0]!;
      throw new IsolationError(
        `Cannot assign ${collision.identityType} identity; it already belongs to another entity`,
      );
    }
  }
  const lockedFields = [...new Set([...row.lockedFields, ...updates.map(([path]) => path)])];
  const evidenceIds = await Promise.all(
    updates.map(([path, value]) => manualEvidence(db, scope, "entity", row.id, path, value)),
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
  for (const identityType of changedIdentityTypes) {
    await db.companyIdentity.deleteMany({
      where: { ...scope, entityId: row.id, identityType },
    });
    const identityValues = nextIdentityValues.get(identityType) ?? [];
    if (identityValues.length > 0) {
      await db.companyIdentity.createMany({
        data: identityValues.map((identityValue) => ({
          ...scope,
          entityId: row.id,
          entityKind: row.kind,
          identityType,
          identityValue,
        })),
      });
    }
  }
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
  if (row.status === "rejected") throw new IsolationError("Rejected entities cannot be confirmed");
  const confirmedAt = new Date();
  await manualEvidence(db, scope, "entity", row.id, "status", "confirmed", scope.ownerUserId);
  await db.companyEntity.update({
    where: { id: row.id },
    data: { status: "confirmed", confirmedAt, confirmedByUserId: scope.ownerUserId },
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

async function mergedEntityGroupIds(
  db: CompanyDb,
  scope: Scope,
  entityId: string,
): Promise<string[]> {
  const parent = await db.companyMerge.findFirst({
    where: { ...scope, sourceEntityId: entityId },
    select: { survivorEntityId: true },
  });
  const rootId = parent?.survivorEntityId ?? entityId;
  const children = await db.companyMerge.findMany({
    where: { ...scope, survivorEntityId: rootId },
    select: { sourceEntityId: true },
  });
  return [rootId, ...children.map((merge) => merge.sourceEntityId)];
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
  const groupIds = new Set(await mergedEntityGroupIds(db, scope, row.id));
  const groupRows = await db.companyEntity.findMany({
    where: { ...scope, id: { in: [...groupIds] } },
    select: { id: true, kind: true, normalizedName: true },
  });
  const identities = await db.companyIdentity.findMany({
    where: { ...scope, entityId: { in: [...groupIds] } },
    select: { entityId: true, entityKind: true, identityType: true, identityValue: true },
  });
  const sourceEvidence = await db.companyEvidence.findMany({
    where: {
      ...scope,
      factKind: "entity",
      factId: { in: [...groupIds] },
      NOT: { sourceKind: "manual" },
    },
    select: { factId: true, sourceKey: true },
  });
  const memberById = new Map(groupRows.map((member) => [member.id, member]));
  const strongAliases = identities
    .filter((identity) => identity.identityType !== "name")
    .map((identity) => `${row.kind}:${identity.identityType}:${identity.identityValue}`);
  const personSourceNameAliases =
    row.kind === "person"
      ? sourceEvidence.flatMap((evidence) => {
          const member = memberById.get(evidence.factId);
          const locator = sourceLocatorFromKey(evidence.sourceKey);
          return member && locator
            ? [`person-source-name:${hash([locator, member.normalizedName])}`]
            : [];
        })
      : [];
  const nameAliases =
    row.kind === "person"
      ? []
      : groupRows.map((member) => `${member.kind}:name:${member.normalizedName}`);
  const aliases = [
    ...strongAliases,
    ...sourceEvidence.map((evidence) => `source:${evidence.sourceKey}`),
    ...personSourceNameAliases,
    ...(strongAliases.length > 0 ? [] : nameAliases),
  ];
  const uniqueAliases = [...new Set(aliases)].sort();
  await db.companyRejection.upsert({
    where: { spaceId_ownerUserId_fingerprint: { ...scope, fingerprint: hash(uniqueAliases) } },
    create: {
      ...scope,
      factKind: "entity",
      entityKind: row.kind,
      fingerprint: hash(uniqueAliases),
      identityAliases: uniqueAliases,
      reason: input.reason ?? null,
    },
    update: { identityAliases: uniqueAliases, reason: input.reason ?? null },
  });
  await manualEvidence(db, scope, "entity", row.id, "status", "rejected");
  await db.companyEntity.updateMany({
    where: { ...scope, id: { in: [...groupIds] } },
    data: { status: "rejected", confirmedAt: null, confirmedByUserId: null },
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

async function editEdge(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEdgeEditInput,
): Promise<CompanyEdgeRecord> {
  const input = CompanyEdgeEditInputSchema.parse(raw);
  const row = await db.companyEdge.findFirstOrThrow({ where: { ...scope, id: input.edgeId } });
  if (row.status === "rejected") throw new IsolationError("Rejected edges cannot be edited");
  const { edgeId: _edgeId, ...fields } = input;
  const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
  const data: Prisma.CompanyEdgeUpdateInput = {};
  for (const [field, value] of updates) {
    if (field === "startsOn" || field === "endsOn") {
      const partial = value as CompanyPartialDate | null;
      Object.assign(data, {
        [field]: dateValue(partial),
        [field === "startsOn" ? "startsPrecision" : "endsPrecision"]: datePrecision(partial),
      });
    } else {
      Object.assign(data, { [field]: value });
    }
  }
  const lockedFields = [...new Set([...row.lockedFields, ...updates.map(([field]) => field)])];
  const correctedEdge = {
    ...row,
    relation: input.relation ?? row.relation,
    startsOn: input.startsOn === undefined ? row.startsOn : dateValue(input.startsOn),
    startsPrecision:
      input.startsOn === undefined ? row.startsPrecision : datePrecision(input.startsOn),
    endsOn: input.endsOn === undefined ? row.endsOn : dateValue(input.endsOn),
    endsPrecision: input.endsOn === undefined ? row.endsPrecision : datePrecision(input.endsOn),
    role: input.role === undefined ? row.role : (input.role ?? null),
  };
  const claimFingerprints = await currentClaimFingerprints(
    db,
    scope,
    "edge",
    row.id,
    row.claimFingerprints,
    edgeClaimFingerprint(row),
    edgeClaimFingerprint(correctedEdge),
  );
  await Promise.all(
    updates.map(([field, value]) =>
      manualEvidence(db, scope, "edge", row.id, field, value ?? null),
    ),
  );
  const updated = await db.companyEdge.update({
    where: { id: row.id },
    data: { ...data, lockedFields, claimFingerprints },
  });
  return mapEdgeRecord(db, scope, updated);
}

async function editEvent(
  db: CompanyDb,
  scope: Scope,
  raw: CompanyEventEditInput,
): Promise<CompanyEventRecord> {
  const input = CompanyEventEditInputSchema.parse(raw);
  const row = await db.companyEvent.findFirstOrThrow({ where: { ...scope, id: input.eventId } });
  if (row.status === "rejected") throw new IsolationError("Rejected events cannot be edited");
  const { eventId: _eventId, entityIds, ...fields } = input;
  const canonicalEditedEntityIds =
    entityIds && entityIds.length > 0 ? await canonicalEventEntityIds(db, scope, entityIds) : [];
  const correctedSubjectKey =
    entityIds !== undefined && entityIds.length > 0
      ? entitySubjectKey(canonicalEditedEntityIds)
      : row.subjectKey;
  const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
  const data: Prisma.CompanyEventUpdateInput = {};
  for (const [field, value] of updates) {
    if (field === "occursOn" || field === "endsOn") {
      const partial = value as CompanyPartialDate | null;
      Object.assign(data, {
        [field]: dateValue(partial),
        [field === "occursOn" ? "occursPrecision" : "endsPrecision"]: datePrecision(partial),
      });
    } else if (field === "title") {
      Object.assign(data, { title: value, normalizedTitle: normalizeCompanyName(value as string) });
    } else {
      Object.assign(data, { [field]: value });
    }
  }
  const correctedEvent = {
    ...row,
    kind: input.kind ?? row.kind,
    subjectKey: correctedSubjectKey,
    normalizedTitle:
      input.title === undefined ? row.normalizedTitle : normalizeCompanyName(input.title),
    occursOn: input.occursOn === undefined ? row.occursOn : dateValue(input.occursOn),
    occursPrecision:
      input.occursOn === undefined ? row.occursPrecision : datePrecision(input.occursOn),
  };
  const previousSubjectKey = await eventSubjectKeyForFingerprint(db, scope, row);
  const subjectChanged = Boolean(entityIds?.length) && correctedSubjectKey !== previousSubjectKey;
  const sourceClaimKeys = await eventSourceClaimKeys(db, scope, row.id, row.sourceClaimKeys);
  const claimFingerprints = subjectChanged
    ? [eventClaimFingerprint(correctedEvent)]
    : [
        ...new Set([
          ...row.claimFingerprints,
          eventClaimFingerprint({ ...row, subjectKey: previousSubjectKey }),
          eventClaimFingerprint(correctedEvent),
        ]),
      ];
  const lockedPaths = [...updates.map(([field]) => field), ...(entityIds ? ["entityIds"] : [])];
  const lockedFields = [...new Set([...row.lockedFields, ...lockedPaths])];
  await Promise.all([
    ...updates.map(([field, value]) =>
      manualEvidence(db, scope, "event", row.id, field, value ?? null),
    ),
    ...(entityIds ? [manualEvidence(db, scope, "event", row.id, "entityIds", entityIds)] : []),
  ]);
  if (entityIds) {
    await db.companyEventEntity.deleteMany({ where: { ...scope, eventId: row.id } });
    await db.companyEventEntity.createMany({
      data: entityIds.map((entityId) => ({ ...scope, eventId: row.id, entityId })),
      skipDuplicates: true,
    });
  }
  const updated = await db.companyEvent.update({
    where: { id: row.id },
    data: {
      ...data,
      lockedFields,
      claimFingerprints,
      sourceClaimKeys: [...new Set(sourceClaimKeys)],
      subjectKey: correctedSubjectKey,
    },
  });
  const links = await db.companyEventEntity.findMany({
    where: { ...scope, eventId: row.id },
    select: { entityId: true },
  });
  return mapEventRecord(
    db,
    scope,
    updated,
    links.map((link) => link.entityId),
  );
}

async function confirmFact(
  db: CompanyDb,
  scope: Scope,
  factKind: "edge" | "event",
  factId: string,
): Promise<CompanyEdgeRecord | CompanyEventRecord> {
  const confirmedAt = new Date();
  await manualEvidence(db, scope, factKind, factId, "status", "confirmed", scope.ownerUserId);
  if (factKind === "edge") {
    const row = await db.companyEdge.findFirstOrThrow({ where: { ...scope, id: factId } });
    if (row.status === "rejected") throw new IsolationError("Rejected edges cannot be confirmed");
    const updated = await db.companyEdge.update({
      where: { id: factId },
      data: { status: "confirmed", confirmedByUserId: scope.ownerUserId, confirmedAt },
    });
    return mapEdgeRecord(db, scope, updated);
  }
  const row = await db.companyEvent.findFirstOrThrow({ where: { ...scope, id: factId } });
  if (row.status === "rejected") throw new IsolationError("Rejected events cannot be confirmed");
  const updated = await db.companyEvent.update({
    where: { id: factId },
    data: { status: "confirmed", confirmedByUserId: scope.ownerUserId, confirmedAt },
  });
  const links = await db.companyEventEntity.findMany({
    where: { ...scope, eventId: row.id },
    select: { entityId: true },
  });
  return mapEventRecord(
    db,
    scope,
    updated,
    links.map((link) => link.entityId),
  );
}

function edgeClaimFingerprint(edge: {
  fromId: string;
  toId: string;
  relation: string;
  startsOn: Date | null;
  startsPrecision: string | null;
  endsOn: Date | null;
  endsPrecision: string | null;
  role: string | null;
}): string {
  return hash({
    relation: edge.relation,
    fromId: edge.fromId,
    toId: edge.toId,
    startsOn: partialDate(edge.startsOn, edge.startsPrecision),
    endsOn: partialDate(edge.endsOn, edge.endsPrecision),
    role: edge.role,
  });
}

function eventClaimFingerprint(event: {
  kind: string;
  normalizedTitle: string;
  occursOn: Date | null;
  occursPrecision: string | null;
  subjectKey: string;
}): string {
  return hash({
    kind: event.kind,
    normalizedTitle: event.normalizedTitle,
    occursOn: partialDate(event.occursOn, event.occursPrecision),
    subjectKey: event.subjectKey,
  });
}

async function rejectFact(
  db: CompanyDb,
  scope: Scope,
  factKind: "edge" | "event",
  factId: string,
  reason?: string | null,
): Promise<CompanyEdgeRecord | CompanyEventRecord> {
  const input = CompanyRejectInputSchema.parse({ entityId: factId, reason });
  const current =
    factKind === "edge"
      ? await db.companyEdge.findFirstOrThrow({ where: { ...scope, id: factId } })
      : await db.companyEvent.findFirstOrThrow({ where: { ...scope, id: factId } });
  const claimFingerprint =
    factKind === "edge"
      ? edgeClaimFingerprint(current as Prisma.CompanyEdgeGetPayload<object>)
      : eventClaimFingerprint({
          ...(current as Prisma.CompanyEventGetPayload<object>),
          subjectKey: await eventSubjectKeyForFingerprint(
            db,
            scope,
            current as Prisma.CompanyEventGetPayload<object>,
          ),
        });
  const sourceAliases =
    factKind === "event"
      ? (current as Prisma.CompanyEventGetPayload<object>).sourceClaimKeys.map(
          (sourceKey) => `source:${sourceKey}`,
        )
      : (
          await db.companyEvidence.findMany({
            where: { ...scope, factKind, factId },
            select: { sourceKey: true },
          })
        ).map((evidence) => `source:${evidence.sourceKey}`);
  const savedClaimFingerprints =
    factKind === "edge"
      ? await currentClaimFingerprints(
          db,
          scope,
          "edge",
          factId,
          current.claimFingerprints,
          claimFingerprint,
        )
      : [
          ...new Set([
            ...(current as Prisma.CompanyEventGetPayload<object>).claimFingerprints,
            claimFingerprint,
          ]),
        ];
  const aliases = [
    ...new Set([
      ...savedClaimFingerprints.map((fingerprint) => `${factKind}:${fingerprint}`),
      ...sourceAliases,
    ]),
  ];
  const fingerprint = hash([factKind, ...aliases.sort()]);
  await db.companyRejection.upsert({
    where: { spaceId_ownerUserId_fingerprint: { ...scope, fingerprint } },
    create: {
      ...scope,
      factKind,
      entityKind: null,
      fingerprint,
      identityAliases: aliases,
      reason: input.reason ?? null,
    },
    update: { identityAliases: aliases, reason: input.reason ?? null },
  });
  await manualEvidence(db, scope, factKind, factId, "status", "rejected");
  if (factKind === "edge") {
    const updated = await db.companyEdge.update({
      where: { id: factId },
      data: { status: "rejected", confirmedByUserId: null, confirmedAt: null },
    });
    return mapEdgeRecord(db, scope, updated);
  }
  const updated = await db.companyEvent.update({
    where: { id: factId },
    data: { status: "rejected", confirmedByUserId: null, confirmedAt: null },
  });
  const links = await db.companyEventEntity.findMany({
    where: { ...scope, eventId: factId },
    select: { entityId: true },
  });
  return mapEventRecord(
    db,
    scope,
    updated,
    links.map((link) => link.entityId),
  );
}

async function eraseEntity(db: CompanyDb, scope: Scope, entityId: string): Promise<void> {
  const row = await db.companyEntity.findFirst({ where: { ...scope, id: entityId } });
  if (!row) throw new IsolationError("Entity not found");
  const identities = await db.companyIdentity.findMany({
    where: { ...scope, entityId },
    select: { identityType: true, identityValue: true },
  });
  const aliases = identities.some((identity) => identity.identityType !== "name")
    ? identities
        .filter((identity) => identity.identityType !== "name")
        .map((identity) => `${row.kind}:${identity.identityType}:${identity.identityValue}`)
    : [`${row.kind}:name:${row.normalizedName}`];
  await db.companyRejection.deleteMany({
    where: {
      ...scope,
      factKind: "entity",
      entityKind: row.kind,
      identityAliases: { hasSome: aliases },
    },
  });
  await db.companyCandidate.deleteMany({
    where: { ...scope, entityIds: { has: row.id } },
  });
  await db.companyEntity.delete({ where: { id: row.id } });
}

async function eraseMap(db: CompanyDb, scope: Scope): Promise<void> {
  await db.companyImportRun.deleteMany({ where: scope });
  await db.companySourceBlock.deleteMany({ where: scope });
  await db.companyMerge.deleteMany({ where: scope });
  await db.companyCandidate.deleteMany({ where: scope });
  await db.companyCorrection.deleteMany({ where: scope });
  await db.companyRejection.deleteMany({ where: scope });
  await db.companyEvidence.deleteMany({ where: scope });
  await db.companyEdge.deleteMany({ where: scope });
  await db.companyEvent.deleteMany({ where: scope });
  await db.companyEntity.deleteMany({ where: scope });
  await db.companyIdentity.deleteMany({ where: scope });
}

async function disconnectSource(
  db: CompanyDb,
  scope: Scope,
  locator: {
    sourceKind: string;
    sourceItemId: string;
    connectionId?: string | null;
    mcpServerId?: string | null;
    dataRoomItemId?: string | null;
  },
): Promise<void> {
  const where = {
    ...scope,
    sourceKind: locator.sourceKind,
    sourceItemId: locator.sourceItemId,
    connectionId: locator.connectionId ?? null,
    mcpServerId: locator.mcpServerId ?? null,
    dataRoomItemId: locator.dataRoomItemId ?? null,
    NOT: { sourceKind: "manual" },
  };
  const candidateWhere = {
    ...scope,
    sourceKind: locator.sourceKind,
    sourceItemId: locator.sourceItemId,
    connectionId: locator.connectionId ?? null,
    mcpServerId: locator.mcpServerId ?? null,
    dataRoomItemId: locator.dataRoomItemId ?? null,
  };
  await db.companyCandidate.deleteMany({ where: candidateWhere });
  await db.companyEvidence.deleteMany({ where });
}

function sourceControlWhere(locator: CompanySourceLocator, scope: Scope) {
  return { ...scope, ...sourceLocatorWhere(locator) };
}

async function validatePrivacyLocator(
  db: CompanyDb,
  scope: Scope,
  locator: CompanySourceLocator,
): Promise<void> {
  if ((locator.sourceKind as string) === "manual")
    throw new CompanyPrivacyBusinessError("Manual evidence cannot be disconnected");
  if (locator.connectionId && locator.mcpServerId)
    throw new CompanyPrivacyBusinessError("Choose one source connection");
  if (locator.sourceKind === "mcp" && locator.connectionId)
    throw new CompanyPrivacyBusinessError("MCP sources must use an MCP server");
  if (locator.connectionId) {
    const connection = await db.connection.findFirst({
      where: { id: locator.connectionId, spaceId: scope.spaceId, userId: scope.ownerUserId },
      select: { id: true },
    });
    if (!connection) throw new IsolationError("Company source not found");
  }
  if (locator.mcpServerId) {
    if (locator.sourceKind !== "mcp")
      throw new CompanyPrivacyBusinessError("MCP sources must use the mcp source kind");
    const server = await db.mcpServer.findFirst({
      where: { id: locator.mcpServerId, spaceId: scope.spaceId, userId: scope.ownerUserId },
      select: { id: true },
    });
    if (!server) throw new IsolationError("Company source not found");
  }
}

async function sourceControl(
  db: CompanyDb,
  scope: Scope,
  locator: CompanySourceLocator,
  connected: boolean,
): Promise<void> {
  await validatePrivacyLocator(db, scope, locator);
  const sourceWhere = sourceControlWhere(locator, scope);
  if (connected) {
    await db.companySourceBlock.deleteMany({
      where: { ...scope, sourceKey: companyPrivacySourceKey(locator) },
    });
    return;
  }
  const linkedDataRoomItems =
    locator.sourceKind === "data_room" && locator.connectionId
      ? await db.dataRoomItem.findMany({
          where: {
            spaceId: scope.spaceId,
            userId: scope.ownerUserId,
            sourceConnectionId: locator.connectionId,
          },
          select: { id: true },
        })
      : [];
  const linkedDataRoomIds = linkedDataRoomItems.map((item) => item.id);
  const affectedSources = await db.companyImportSource.findMany({
    where: {
      ...scope,
      ...sourceLocatorWhere(locator),
      run: { status: { in: ["draft", "awaiting_consent", "running", "paused", "budget_reached"] } },
    },
    select: { id: true, runId: true },
  });
  const linkedDataRoomRuns =
    linkedDataRoomIds.length > 0
      ? await db.companyImportRun.findMany({
          where: {
            ...scope,
            status: { in: ["draft", "awaiting_consent", "running", "paused", "budget_reached"] },
            sources: { some: { sourceKind: "data_room" } },
          },
          select: { id: true },
        })
      : [];
  const runIds = [
    ...new Set([
      ...affectedSources.map((source) => source.runId),
      ...linkedDataRoomRuns.map((run) => run.id),
    ]),
  ];
  if (runIds.length) {
    await db.companyImportRun.updateMany({
      where: {
        ...scope,
        id: { in: runIds },
        status: { in: ["draft", "awaiting_consent", "running", "paused", "budget_reached"] },
      },
      data: { status: "cancelled", completedAt: new Date() },
    });
    await db.companyImportUnit.updateMany({
      where: { ...scope, runId: { in: runIds }, status: { in: ["waiting", "claimed"] } },
      data: { status: "cancelled", claimToken: null, claimExpiresAt: null },
    });
  }
  await db.companySourceBlock.upsert({
    where: {
      spaceId_ownerUserId_sourceKey: {
        spaceId: scope.spaceId,
        ownerUserId: scope.ownerUserId,
        sourceKey: companyPrivacySourceKey(locator),
      },
    },
    create: {
      ...scope,
      sourceKey: companyPrivacySourceKey(locator),
      sourceKind: locator.sourceKind,
      connectionId: locator.connectionId,
      mcpServerId: locator.mcpServerId,
    },
    update: {},
  });
  await db.companyCandidate.deleteMany({ where: sourceWhere });
  if (linkedDataRoomIds.length > 0) {
    await db.companyCandidate.deleteMany({
      where: { ...scope, sourceKind: "data_room", dataRoomItemId: { in: linkedDataRoomIds } },
    });
    await db.companyEvidence.deleteMany({
      where: {
        ...scope,
        sourceKind: "data_room",
        dataRoomItemId: { in: linkedDataRoomIds },
        NOT: { sourceKind: "manual" },
      },
    });
  }
  await db.companyEvidence.deleteMany({
    where: {
      ...sourceWhere,
      NOT: { sourceKind: "manual" },
    },
  });
}

async function privacy(db: CompanyDb, scope: Scope): Promise<CompanyPrivacy> {
  const [evidence, sources, blocks] = await Promise.all([
    db.companyEvidence.findMany({
      where: { ...scope, NOT: { sourceKind: "manual" } },
      select: { sourceKind: true, connectionId: true, mcpServerId: true },
    }),
    db.companyImportSource.findMany({
      where: { ...scope, sourceKind: { not: "manual" }, run: { status: { not: "discarded" } } },
      select: { sourceKind: true, connectionId: true },
      distinct: ["sourceKind", "connectionId"],
    }),
    db.companySourceBlock.findMany({ where: scope }),
  ]);
  const locators = new Map<string, CompanySourceLocator>();
  for (const row of evidence) {
    const locator = {
      sourceKind: row.sourceKind as CompanySourceLocator["sourceKind"],
      connectionId: row.connectionId,
      mcpServerId: row.mcpServerId,
    };
    locators.set(companyPrivacySourceKey(locator), locator);
  }
  for (const row of sources) {
    const locator = {
      sourceKind: row.sourceKind as CompanySourceLocator["sourceKind"],
      connectionId: row.connectionId,
      mcpServerId: null,
    };
    locators.set(companyPrivacySourceKey(locator), locator);
  }
  for (const block of blocks) {
    const locator = {
      sourceKind: block.sourceKind as CompanySourceLocator["sourceKind"],
      connectionId: block.connectionId,
      mcpServerId: block.mcpServerId,
    };
    locators.set(companyPrivacySourceKey(locator), locator);
  }
  const aggregateBlocks = new Set(
    blocks
      .filter((block) => block.connectionId === null && block.mcpServerId === null)
      .map((block) => block.sourceKind),
  );
  return {
    sources: await Promise.all(
      [...locators.values()]
        .filter(
          (locator) =>
            !(locator.connectionId || locator.mcpServerId) ||
            !aggregateBlocks.has(locator.sourceKind),
        )
        .sort((a, b) => companyPrivacySourceKey(a).localeCompare(companyPrivacySourceKey(b)))
        .map(async (locator) => {
          const evidenceCount = await db.companyEvidence.count({
            where: { ...scope, ...sourceLocatorWhere(locator), NOT: { sourceKind: "manual" } },
          });
          const connection = locator.connectionId
            ? await db.connection.findFirst({
                where: {
                  id: locator.connectionId,
                  spaceId: scope.spaceId,
                  userId: scope.ownerUserId,
                },
                select: { displayName: true },
              })
            : null;
          const server = locator.mcpServerId
            ? await db.mcpServer.findFirst({
                where: {
                  id: locator.mcpServerId,
                  spaceId: scope.spaceId,
                  userId: scope.ownerUserId,
                },
                select: { name: true },
              })
            : null;
          return {
            ...locator,
            label: locator.connectionId
              ? (connection?.displayName ?? locator.sourceKind.replaceAll("_", " "))
              : locator.mcpServerId
                ? (server?.name ?? "MCP")
                : locator.sourceKind.replaceAll("_", " "),
            evidenceCount,
            blocked: blocks.some(
              (block) =>
                block.sourceKey === companyPrivacySourceKey(locator) ||
                (block.sourceKind === locator.sourceKind &&
                  block.connectionId === null &&
                  block.mcpServerId === null),
            ),
          };
        }),
    ),
  };
}

async function exportMap(db: CompanyDb, scope: Scope): Promise<CompanyExport> {
  const [entities, edges, events, evidence] = await Promise.all([
    db.companyEntity.findMany({ where: scope, include: ENTITY_INCLUDE }),
    db.companyEdge.findMany({ where: scope }),
    db.companyEvent.findMany({ where: scope }),
    db.companyEvidence.findMany({ where: scope }),
  ]);
  const eventLinks = await db.companyEventEntity.findMany({
    where: scope,
    select: { eventId: true, entityId: true },
  });
  const eventIds = new Map<string, string[]>();
  for (const link of eventLinks)
    eventIds.set(link.eventId, [...(eventIds.get(link.eventId) ?? []), link.entityId]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entities: await Promise.all(
      entities.map((row) =>
        mapEntity(db, scope, row, { includeMerged: true, includeRejected: true }),
      ),
    ),
    edges: await Promise.all(edges.map((row) => mapEdgeRecord(db, scope, row))),
    events: await Promise.all(
      events.map((row) => mapEventRecord(db, scope, row, eventIds.get(row.id) ?? [])),
    ),
    evidence: evidence.map(toEvidence),
  };
}

async function setVisibility(
  db: CompanyDb,
  scope: Scope,
  input: { kind: "entity" | "edge" | "event"; id: string; visibility: "private" | "team" },
): Promise<void> {
  if (input.kind === "entity") {
    const row = await db.companyEntity.findFirst({ where: { ...scope, id: input.id } });
    if (!row) throw new IsolationError("Company fact not found");
    if (input.visibility === "team" && row.status !== "confirmed")
      throw new CompanyPrivacyBusinessError("Confirm this fact first");
    await db.companyEntity.update({
      where: { id: row.id },
      data: { visibility: input.visibility },
    });
    if (input.visibility === "private") {
      await db.companyEdge.updateMany({
        where: { ...scope, OR: [{ fromId: row.id }, { toId: row.id }], visibility: "team" },
        data: { visibility: "private" },
      });
      const events = await db.companyEventEntity.findMany({
        where: { ...scope, entityId: row.id },
        select: { eventId: true },
      });
      await db.companyEvent.updateMany({
        where: { ...scope, id: { in: events.map((event) => event.eventId) }, visibility: "team" },
        data: { visibility: "private" },
      });
    }
    return;
  }
  if (input.kind === "edge") {
    const edge = await db.companyEdge.findFirst({ where: { ...scope, id: input.id } });
    if (!edge) throw new IsolationError("Company fact not found");
    if (input.visibility === "team") {
      if (edge.status !== "confirmed")
        throw new CompanyPrivacyBusinessError("Confirm this fact first");
      const endpoints = await db.companyEntity.findMany({
        where: { ...scope, id: { in: [edge.fromId, edge.toId] } },
        select: { status: true, visibility: true },
      });
      if (
        endpoints.length !== 2 ||
        endpoints.some(
          (endpoint) => endpoint.status !== "confirmed" || endpoint.visibility !== "team",
        )
      )
        throw new CompanyPrivacyBusinessError("Share linked facts first");
    }
    await db.companyEdge.update({ where: { id: edge.id }, data: { visibility: input.visibility } });
    return;
  }
  const event = await db.companyEvent.findFirst({ where: { ...scope, id: input.id } });
  if (!event) throw new IsolationError("Company fact not found");
  if (input.visibility === "team") {
    if (event.status !== "confirmed")
      throw new CompanyPrivacyBusinessError("Confirm this fact first");
    const links = await db.companyEventEntity.findMany({
      where: { ...scope, eventId: event.id },
      select: { entityId: true },
    });
    const endpoints = await db.companyEntity.findMany({
      where: { ...scope, id: { in: links.map((link) => link.entityId) } },
      select: { status: true, visibility: true },
    });
    if (
      endpoints.length !== links.length ||
      endpoints.some(
        (endpoint) => endpoint.status !== "confirmed" || endpoint.visibility !== "team",
      )
    )
      throw new CompanyPrivacyBusinessError("Share linked facts first");
  }
  await db.companyEvent.update({ where: { id: event.id }, data: { visibility: input.visibility } });
}

async function excludePerson(db: CompanyDb, scope: Scope, entityId: string): Promise<void> {
  const current = await db.companyEntity.findFirst({
    where: { ...scope, id: entityId, kind: "person" },
    select: { id: true, kind: true, displayName: true, attrs: true },
  });
  if (!current) throw new IsolationError("Company person not found");
  const ids = await mergedEntityGroupIds(db, scope, current.id);
  const members = await db.companyEntity.findMany({
    where: { ...scope, id: { in: ids } },
    select: { displayName: true, attrs: true },
  });
  const aliases = new Set<string>();
  for (const member of members) {
    for (const alias of companyExcludedPersonAliases({
      kind: "person",
      displayName: member.displayName,
      confidence: 0,
      attrs: member.attrs as Extract<CompanyEntityInput, { kind: "person" }>["attrs"],
    }))
      aliases.add(alias);
  }
  const identities = await db.companyIdentity.findMany({
    where: { ...scope, entityId: { in: ids } },
    select: { identityType: true, identityValue: true },
  });
  for (const identity of identities)
    aliases.add(`person:${identity.identityType}:${identity.identityValue}`);
  const sortedAliases = [...aliases].sort();
  const aliasSet = new Set(sortedAliases);
  const candidates = await db.companyCandidate.findMany({
    where: {
      ...scope,
      OR: [
        { kind: "person" },
        { kind: { in: ["edge", "event"] }, reason: "unresolved_import_subjects" },
      ],
    },
    select: { id: true, kind: true, entityIds: true, proposedFact: true },
  });
  const matchingCandidateIds = candidates
    .filter((candidate) => {
      if (candidate.entityIds.some((id) => ids.includes(id))) return true;
      const proposed = candidate.proposedFact;
      if (!proposed || typeof proposed !== "object" || Array.isArray(proposed)) return false;
      const value = proposed as Record<string, unknown>;
      const proposedEntities =
        candidate.kind === "person"
          ? [value.entity ?? value.person ?? proposed]
          : Array.isArray(value.entities)
            ? value.entities.flatMap((entry) =>
                entry && typeof entry === "object" && !Array.isArray(entry)
                  ? [(entry as Record<string, unknown>).entity]
                  : [],
              )
            : [];
      return proposedEntities.some((entity) => {
        const parsed = CompanyEntityInputSchema.safeParse(entity);
        return (
          parsed.success &&
          parsed.data.kind === "person" &&
          companyExcludedPersonAliases(parsed.data).some((alias) => aliasSet.has(alias))
        );
      });
    })
    .map((candidate) => candidate.id);
  const fingerprint = hash(["excluded-person", sortedAliases]);
  await db.companyRejection.upsert({
    where: { spaceId_ownerUserId_fingerprint: { ...scope, fingerprint } },
    create: {
      ...scope,
      factKind: "entity",
      entityKind: "person",
      fingerprint,
      identityAliases: sortedAliases,
      reason: "excluded_person",
      excludedPerson: true,
    },
    update: { identityAliases: sortedAliases, excludedPerson: true },
  });
  const linkedEvents = await db.companyEventEntity.findMany({
    where: { ...scope, entityId: { in: ids } },
    select: { eventId: true },
  });
  for (const eventId of [...new Set(linkedEvents.map((link) => link.eventId))]) {
    const links = await db.companyEventEntity.findMany({
      where: { ...scope, eventId },
      select: { entityId: true },
    });
    if (links.every((link) => ids.includes(link.entityId)))
      await db.companyEvent.deleteMany({ where: { ...scope, id: eventId } });
  }
  await db.companyEdge.deleteMany({
    where: { ...scope, OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
  });
  await db.companyCandidate.deleteMany({
    where: {
      ...scope,
      OR: [{ entityIds: { hasSome: ids } }, { id: { in: matchingCandidateIds } }],
    },
  });
  await db.companyEntity.deleteMany({ where: { ...scope, id: { in: ids } } });
}

async function teamFacts(
  db: RootDb,
  scope: Scope,
  text?: string,
): Promise<{
  entities: CompanyEntityRecord[];
  edges: CompanyEdgeRecord[];
  events: CompanyEventRecord[];
}> {
  await requireMember(db, scope);
  const memberRows = await db.spaceMember.findMany({
    where: { spaceId: scope.spaceId },
    select: { userId: true },
  });
  const otherMemberIds = memberRows
    .map((member) => member.userId)
    .filter((userId) => userId !== scope.ownerUserId);
  const [hidden, owners] = await Promise.all([
    db.companyMerge.findMany({
      where: { spaceId: scope.spaceId, sourceEntity: { ownerUserId: { not: scope.ownerUserId } } },
      select: { sourceEntityId: true, sourceEntity: { select: { ownerUserId: true } } },
    }),
    db.companyEntity.findMany({
      where: {
        spaceId: scope.spaceId,
        ownerUserId: { in: otherMemberIds },
        status: "confirmed",
        visibility: "team",
      },
      orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
    }),
  ]);
  const hiddenKeys = new Set(
    hidden.map((merge) => `${merge.sourceEntity.ownerUserId}:${merge.sourceEntityId}`),
  );
  const visibleOwners = owners.filter((row) => !hiddenKeys.has(`${row.ownerUserId}:${row.id}`));
  const entities: CompanyEntityRecord[] = visibleOwners.map((row) => ({
    readOnly: true,
    id: row.id,
    kind: row.kind as CompanyEntityRecord["kind"],
    displayName: row.displayName,
    normalizedName: row.normalizedName,
    attrs: Object.fromEntries(
      Object.entries(row.attrs as Record<string, unknown>).filter(([key]) => key !== "trackerUrl"),
    ),
    confidence: row.confidence,
    status: row.status as CompanyEntityRecord["status"],
    visibility: "team",
    lockedFields: [],
    confirmedAt: null,
    confirmedByUserId: null,
    identities: [],
    evidence: [],
    mergedFrom: [],
    edges: [],
    events: [],
    contactId: null,
    legalContractId: null,
    dataRoomItemId: null,
  }));
  const ownerIds = [...new Set(otherMemberIds)];
  const rows = ownerIds.length
    ? await db.companyEdge.findMany({
        where: {
          spaceId: scope.spaceId,
          ownerUserId: { in: ownerIds },
          status: "confirmed",
          visibility: "team",
        },
      })
    : [];
  const sharedIds = new Set(visibleOwners.map((owner) => `${owner.ownerUserId}:${owner.id}`));
  const edges = await Promise.all(
    rows
      .filter(
        (row) =>
          sharedIds.has(`${row.ownerUserId}:${row.fromId}`) &&
          sharedIds.has(`${row.ownerUserId}:${row.toId}`),
      )
      .map(async (row) => ({
        ...(await mapEdgeRecord(db, { spaceId: row.spaceId, ownerUserId: row.ownerUserId }, row)),
        readOnly: true,
        evidence: [],
        lockedFields: [],
        confirmedByUserId: null,
        confirmedAt: null,
      })),
  );
  const eventRows = ownerIds.length
    ? await db.companyEvent.findMany({
        where: {
          spaceId: scope.spaceId,
          ownerUserId: { in: ownerIds },
          status: "confirmed",
          visibility: "team",
        },
      })
    : [];
  const links = eventRows.length
    ? await db.companyEventEntity.findMany({
        where: {
          spaceId: scope.spaceId,
          ownerUserId: { in: ownerIds },
          eventId: { in: eventRows.map((row) => row.id) },
        },
        select: { eventId: true, entityId: true, ownerUserId: true },
      })
    : [];
  const linkedByEvent = new Map<string, string[]>();
  for (const link of links)
    linkedByEvent.set(`${link.ownerUserId}:${link.eventId}`, [
      ...(linkedByEvent.get(`${link.ownerUserId}:${link.eventId}`) ?? []),
      link.entityId,
    ]);
  const events = await Promise.all(
    eventRows
      .filter((row) => {
        const endpoints = linkedByEvent.get(`${row.ownerUserId}:${row.id}`) ?? [];
        return endpoints.every((id) => sharedIds.has(`${row.ownerUserId}:${id}`));
      })
      .map(async (row) => ({
        ...(await mapEventRecord(
          db,
          { spaceId: row.spaceId, ownerUserId: row.ownerUserId },
          row,
          linkedByEvent.get(`${row.ownerUserId}:${row.id}`) ?? [],
        )),
        readOnly: true,
        evidence: [],
        lockedFields: [],
        confirmedByUserId: null,
        confirmedAt: null,
      })),
  );
  const needle = text?.trim().toLocaleLowerCase();
  const normalizedNeedle = normalizeCompanyName(text ?? "");
  return {
    entities: needle
      ? entities.filter(
          (row) =>
            row.displayName.toLocaleLowerCase().includes(needle) ||
            row.normalizedName.includes(normalizedNeedle),
        )
      : entities,
    edges: needle
      ? edges.filter((row) =>
          `${row.relation} ${row.role ?? ""}`.toLocaleLowerCase().includes(needle),
        )
      : edges,
    events: needle
      ? events.filter((row) => row.title.toLocaleLowerCase().includes(needle))
      : events,
  };
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
  if (
    source.status !== survivor.status &&
    [source.status, survivor.status].some(
      (status) => status === "confirmed" || status === "rejected",
    )
  ) {
    throw new IsolationError(
      "Confirmed or rejected entities with conflicting statuses cannot merge",
    );
  }
  if (await db.companyMerge.findFirst({ where: { ...scope, sourceEntityId: source.id } })) {
    throw new IsolationError("Entity is already merged");
  }
  if (await db.companyMerge.findFirst({ where: { ...scope, survivorEntityId: source.id } })) {
    throw new IsolationError("Entities with existing merged children cannot be merged");
  }
  if (await db.companyMerge.findFirst({ where: { ...scope, sourceEntityId: survivor.id } })) {
    throw new IsolationError("Chained merges are not allowed");
  }
  const existingChildren = await db.companyMerge.findMany({
    where: { ...scope, survivorEntityId: survivor.id },
    select: { sourceEntityId: true },
  });
  const mergeGroup = await db.companyEntity.findMany({
    where: {
      ...scope,
      id: {
        in: [survivor.id, source.id, ...existingChildren.map((merge) => merge.sourceEntityId)],
      },
    },
    select: { displayName: true, attrs: true, lockedFields: true },
  });
  const lockedValues = new Map<string, string | undefined>();
  for (const member of mergeGroup) {
    const attrs = member.attrs as Record<string, unknown>;
    for (const fieldPath of member.lockedFields) {
      const value =
        fieldPath === "displayName"
          ? member.displayName
          : fieldPath.startsWith("attrs.")
            ? attrs[fieldPath.slice("attrs.".length)]
            : undefined;
      const serialized = JSON.stringify(value);
      if (lockedValues.has(fieldPath) && lockedValues.get(fieldPath) !== serialized) {
        throw new IsolationError("Conflicting locked values cannot be merged");
      }
      lockedValues.set(fieldPath, serialized);
    }
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
    editEdge: (input: CompanyEdgeEditInput) => write((tx) => editEdge(tx, scope, input)),
    editEvent: (input: CompanyEventEditInput) => write((tx) => editEvent(tx, scope, input)),
    confirm: (entityId: string) => write((tx) => confirmEntity(tx, scope, entityId)),
    confirmEdge: (edgeId: string) => write((tx) => confirmFact(tx, scope, "edge", edgeId)),
    confirmEvent: (eventId: string) => write((tx) => confirmFact(tx, scope, "event", eventId)),
    reject: (entityId: string, reason?: string) =>
      write((tx) => rejectEntity(tx, scope, entityId, reason)),
    rejectEdge: (edgeId: string, reason?: string) =>
      write((tx) => rejectFact(tx, scope, "edge", edgeId, reason)),
    rejectEvent: (eventId: string, reason?: string) =>
      write((tx) => rejectFact(tx, scope, "event", eventId, reason)),
    disconnect: (
      sourceKind: string,
      sourceItemId: string,
      sourceScope?: {
        connectionId?: string | null;
        mcpServerId?: string | null;
        dataRoomItemId?: string | null;
      },
    ) => write((tx) => disconnectSource(tx, scope, { sourceKind, sourceItemId, ...sourceScope })),
    disconnectConnection: (connectionId: string) =>
      write(async (tx) => {
        const [evidenceSources, importSources] = await Promise.all([
          tx.companyEvidence.findMany({
            where: { ...scope, connectionId, NOT: { sourceKind: "manual" } },
            select: { sourceKind: true },
            distinct: ["sourceKind"],
          }),
          tx.companyImportSource.findMany({
            where: { ...scope, connectionId },
            select: { sourceKind: true, runId: true },
          }),
        ]);
        const sourceKinds = [
          ...new Set([...evidenceSources, ...importSources].map((source) => source.sourceKind)),
        ];
        for (const sourceKind of sourceKinds) {
          const locator = {
            sourceKind: sourceKind as CompanySourceLocator["sourceKind"],
            connectionId,
            mcpServerId: null,
          };
          const sourceKey = companyPrivacySourceKey(locator);
          await tx.companySourceBlock.upsert({
            where: { spaceId_ownerUserId_sourceKey: { ...scope, sourceKey } },
            create: {
              ...scope,
              sourceKey,
              sourceKind,
              connectionId,
              mcpServerId: null,
            },
            update: {},
          });
        }
        const runIds = [...new Set(importSources.map((source) => source.runId))];
        if (runIds.length) {
          await tx.companyImportRun.updateMany({
            where: { ...scope, id: { in: runIds }, status: { in: ["running", "paused"] } },
            data: { status: "cancelled", completedAt: new Date() },
          });
          await tx.companyImportUnit.updateMany({
            where: { ...scope, runId: { in: runIds }, status: { in: ["waiting", "claimed"] } },
            data: { status: "cancelled", claimToken: null, claimExpiresAt: null },
          });
        }
        await tx.companyCandidate.deleteMany({ where: { ...scope, connectionId } });
        await tx.companyEvidence.deleteMany({
          where: { ...scope, connectionId, NOT: { sourceKind: "manual" } },
        });
      }),
    sourceControl: (locator: CompanySourceLocator, connected: boolean) =>
      write((tx) => sourceControl(tx, scope, locator, connected)),
    disconnectMcpServer: (mcpServerId: string) =>
      write(async (tx) => {
        const candidates = await tx.companyEvidence.findMany({
          where: { ...scope, mcpServerId, NOT: { sourceKind: "manual" } },
          select: { sourceKind: true, sourceItemId: true },
          distinct: ["sourceKind", "sourceItemId"],
        });
        await tx.companyCandidate.deleteMany({ where: { ...scope, mcpServerId } });
        await tx.companyEvidence.deleteMany({
          where: { ...scope, mcpServerId, NOT: { sourceKind: "manual" } },
        });
        return candidates.length;
      }),
    erase: (entityId: string) => write((tx) => eraseEntity(tx, scope, entityId)),
    eraseMap: () => write((tx) => eraseMap(tx, scope)),
    merge: (sourceEntityId: string, survivorEntityId: string) =>
      write((tx) => mergeEntities(tx, scope, sourceEntityId, survivorEntityId)),
    split: (sourceEntityId: string) => write((tx) => splitEntity(tx, scope, sourceEntityId)),
  };
}

export function companyWriter(tx: Prisma.TransactionClient, actor: Actor) {
  return {
    ...writerFor(tx, actor),
    deferImportRelation: async (input: {
      kind: "edge" | "event";
      entityIds: string[];
      proposedFact: unknown;
      evidence: CompanyEvidenceInput;
    }) => {
      const scope = ownerOf(actor);
      await requireMember(tx, scope);
      const evidence = CompanyEvidenceInputSchema.parse(input.evidence);
      if (evidence.sourceKind === "manual")
        throw new IsolationError("Manual evidence requires owner input");
      await assertSourceAllowed(tx, scope, evidence);
      return createCandidate(tx, scope, {
        kind: input.kind,
        reason: "unresolved_import_subjects",
        entityIds: input.entityIds,
        proposedFact: input.proposedFact,
        sourceKind: evidence.sourceKind,
        connectionId: evidence.connectionId ?? null,
        mcpServerId: evidence.mcpServerId ?? null,
        dataRoomItemId: await linkedDataRoomItemId(tx, scope, evidence),
        sourceItemId: evidence.sourceItemId,
        sourceKey: sourceKey(
          evidence,
          createHash("sha256").update(JSON.stringify(input.proposedFact)).digest("hex"),
        ),
        quote: evidence.quote,
        contentHash: evidence.contentHash,
        importRunId: evidence.extractorRunId,
      });
    },
  };
}

export function companyForActor(prisma: RootDb, actor: Actor) {
  const scope = ownerOf(actor);
  const write = async <T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    isolationLevel?: Prisma.TransactionIsolationLevel,
  ): Promise<T> => {
    await requireMember(prisma, scope);
    const transaction = async (tx: Prisma.TransactionClient) => {
      await requireMember(tx, scope);
      await lockScope(tx, scope);
      return operation(tx);
    };
    return withTransactionRetry(() =>
      isolationLevel
        ? prisma.$transaction(transaction, { isolationLevel })
        : prisma.$transaction(transaction),
    );
  };
  return {
    list: async (
      filter: {
        kind?: string;
        text?: string;
        includeMerged?: boolean;
        includeRejected?: boolean;
      } = {},
    ) => {
      await requireMember(prisma, scope);
      const baseWhere = {
        ...scope,
        ...(filter.includeRejected ? {} : { status: { not: "rejected" } }),
        ...(filter.kind ? { kind: filter.kind } : {}),
      };
      const rows = await prisma.companyEntity.findMany({
        where: {
          ...baseWhere,
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
      const expandedRows = [...rows];
      if (filter.text && rows.length > 0) {
        const matchedIds = new Set(rows.map((row) => row.id));
        const merges = await prisma.companyMerge.findMany({
          where: { ...scope, sourceEntityId: { in: [...matchedIds] } },
          select: { survivorEntityId: true },
        });
        const missingSurvivorIds = [
          ...new Set(
            merges.map((merge) => merge.survivorEntityId).filter((id) => !matchedIds.has(id)),
          ),
        ];
        if (missingSurvivorIds.length > 0) {
          expandedRows.push(
            ...(await prisma.companyEntity.findMany({
              where: { ...baseWhere, id: { in: missingSurvivorIds } },
              include: ENTITY_INCLUDE,
              orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
            })),
          );
        }
      }
      const hidden = filter.includeMerged ? new Set<string>() : await hiddenIds(prisma, scope);
      const records = await Promise.all(
        expandedRows
          .filter((row) => !hidden.has(row.id))
          .map((row) =>
            mapEntity(prisma, scope, row, {
              includeMerged: filter.includeMerged,
              includeRejected: filter.includeRejected,
            }),
          ),
      );
      return [...new Map(records.map((record) => [record.id, record])).values()];
    },
    search: async (text: string, options: { includeRejected?: boolean } = {}) => {
      const records = await companyForActor(prisma, actor).list({ text, ...options });
      return records;
    },
    count: async (
      filter: { kind?: string; includeMerged?: boolean; includeRejected?: boolean } = {},
    ) => {
      await requireMember(prisma, scope);
      const count = await prisma.companyEntity.count({
        where: {
          ...scope,
          ...(filter.kind ? { kind: filter.kind } : {}),
          ...(filter.includeRejected ? {} : { status: { not: "rejected" } }),
        },
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
                ...(filter.includeRejected ? {} : { status: { not: "rejected" } }),
              },
            });
      return count - hiddenInFilter;
    },
    detail: async (
      entityId: string,
      options: { includeMerged?: boolean; includeRejected?: boolean } = {},
    ) => {
      await requireMember(prisma, scope);
      if (!options.includeMerged && (await hiddenIds(prisma, scope)).has(entityId)) return null;
      const row = await prisma.companyEntity.findFirst({
        where: { ...scope, id: entityId },
        include: ENTITY_INCLUDE,
      });
      if (row?.status === "rejected" && !options.includeRejected) return null;
      return row
        ? mapEntity(prisma, scope, row, {
            includeMerged: options.includeMerged,
            includeRejected: options.includeRejected,
          })
        : null;
    },
    evidence: async (entityId: string, options: { includeRejected?: boolean } = {}) => {
      await requireMember(prisma, scope);
      const row = await prisma.companyEntity.findFirst({
        where: { ...scope, id: entityId },
        select: { id: true, status: true },
      });
      if (
        !row ||
        (row.status === "rejected" && !options.includeRejected) ||
        (await hiddenIds(prisma, scope)).has(entityId)
      )
        return [];
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
    listEdges: async (
      filter: { entityId?: string; relation?: string; includeRejected?: boolean } = {},
    ) => {
      await requireMember(prisma, scope);
      const entityIds = filter.entityId
        ? [
            filter.entityId,
            ...(
              await prisma.companyMerge.findMany({
                where: { ...scope, survivorEntityId: filter.entityId },
                select: { sourceEntityId: true },
              })
            ).map((merge) => merge.sourceEntityId),
          ]
        : undefined;
      const rows = await prisma.companyEdge.findMany({
        where: {
          ...scope,
          ...(filter.includeRejected ? {} : { status: { not: "rejected" } }),
          ...(filter.relation ? { relation: filter.relation } : {}),
          ...(entityIds
            ? { OR: [{ fromId: { in: entityIds } }, { toId: { in: entityIds } }] }
            : {}),
        },
        orderBy: [{ startsOn: "asc" }, { id: "asc" }],
      });
      const rejectedEntities = new Set(
        (
          await prisma.companyEntity.findMany({
            where: {
              ...scope,
              id: { in: [...new Set(rows.flatMap((row) => [row.fromId, row.toId]))] },
              status: "rejected",
            },
            select: { id: true },
          })
        ).map((row) => row.id),
      );
      return Promise.all(
        rows
          .filter(
            (row) =>
              filter.includeRejected ||
              (!rejectedEntities.has(row.fromId) && !rejectedEntities.has(row.toId)),
          )
          .map(async (row) => ({
            ...(await mapEdgeRecord(prisma, scope, row)),
            fromId: await resolveSurvivorId(prisma, scope, row.fromId),
            toId: await resolveSurvivorId(prisma, scope, row.toId),
          })),
      );
    },
    countEdges: async (
      filter: { entityId?: string; relation?: string; includeRejected?: boolean } = {},
    ) => {
      await requireMember(prisma, scope);
      return (await companyForActor(prisma, actor).listEdges(filter)).length;
    },
    edgeDetail: async (
      edgeId: string,
      options: { includeRejected?: boolean } = {},
    ): Promise<CompanyEdgeRecord | null> => {
      await requireMember(prisma, scope);
      const row = await prisma.companyEdge.findFirst({ where: { ...scope, id: edgeId } });
      if (!row || (row.status === "rejected" && !options.includeRejected)) return null;
      if (!options.includeRejected) {
        const rejectedEndpoint = await prisma.companyEntity.findFirst({
          where: { ...scope, id: { in: [row.fromId, row.toId] }, status: "rejected" },
          select: { id: true },
        });
        if (rejectedEndpoint) return null;
      }
      return {
        ...(await mapEdgeRecord(prisma, scope, row)),
        fromId: await resolveSurvivorId(prisma, scope, row.fromId),
        toId: await resolveSurvivorId(prisma, scope, row.toId),
      };
    },
    listEvents: async (
      filter: { entityId?: string; stream?: string; kind?: string; includeRejected?: boolean } = {},
    ) => {
      await requireMember(prisma, scope);
      const entityIds = filter.entityId
        ? [
            filter.entityId,
            ...(
              await prisma.companyMerge.findMany({
                where: { ...scope, survivorEntityId: filter.entityId },
                select: { sourceEntityId: true },
              })
            ).map((merge) => merge.sourceEntityId),
          ]
        : undefined;
      const rows = await prisma.companyEvent.findMany({
        where: {
          ...scope,
          ...(filter.includeRejected ? {} : { status: { not: "rejected" } }),
          ...(filter.stream ? { stream: filter.stream } : {}),
          ...(filter.kind ? { kind: filter.kind } : {}),
          ...(entityIds ? { entityLinks: { some: { entityId: { in: entityIds } } } } : {}),
        },
        orderBy: [{ occursOn: "asc" }, { id: "asc" }],
      });
      const links = rows.length
        ? await prisma.companyEventEntity.findMany({
            where: { ...scope, eventId: { in: rows.map((row) => row.id) } },
            select: { eventId: true, entityId: true },
          })
        : [];
      const rejectedEntityIds = new Set(
        (
          await prisma.companyEntity.findMany({
            where: {
              ...scope,
              id: { in: [...new Set(links.map((link) => link.entityId))] },
              status: "rejected",
            },
            select: { id: true },
          })
        ).map((row) => row.id),
      );
      const hiddenEventIds = new Set(
        links.filter((link) => rejectedEntityIds.has(link.entityId)).map((link) => link.eventId),
      );
      const visibleRows = filter.includeRejected
        ? rows
        : rows.filter((row) => !hiddenEventIds.has(row.id));
      return Promise.all(
        visibleRows.map(async (row) => {
          const links = await prisma.companyEventEntity.findMany({
            where: { ...scope, eventId: row.id },
            select: { entityId: true },
          });
          return mapEventRecord(prisma, scope, row, [
            ...new Set(
              await Promise.all(
                links.map((link) => resolveSurvivorId(prisma, scope, link.entityId)),
              ),
            ),
          ]);
        }),
      );
    },
    countEvents: async (
      filter: { entityId?: string; stream?: string; kind?: string; includeRejected?: boolean } = {},
    ) => {
      await requireMember(prisma, scope);
      return (await companyForActor(prisma, actor).listEvents(filter)).length;
    },
    eventDetail: async (
      eventId: string,
      options: { includeRejected?: boolean } = {},
    ): Promise<CompanyEventRecord | null> => {
      await requireMember(prisma, scope);
      const row = await prisma.companyEvent.findFirst({ where: { ...scope, id: eventId } });
      if (!row || (row.status === "rejected" && !options.includeRejected)) return null;
      const links = await prisma.companyEventEntity.findMany({
        where: { ...scope, eventId: row.id },
        select: { entityId: true },
      });
      if (!options.includeRejected && links.length) {
        const rejectedEntity = await prisma.companyEntity.findFirst({
          where: {
            ...scope,
            id: { in: links.map((link) => link.entityId) },
            status: "rejected",
          },
          select: { id: true },
        });
        if (rejectedEntity) return null;
      }
      return mapEventRecord(prisma, scope, row, [
        ...new Set(
          await Promise.all(links.map((link) => resolveSurvivorId(prisma, scope, link.entityId))),
        ),
      ]);
    },
    candidates: async () => {
      await requireMember(prisma, scope);
      const rows = await prisma.companyCandidate.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(
        (row): CompanyCandidateRecord => ({
          id: row.id,
          kind: row.kind,
          reason: row.reason,
          entityIds: row.entityIds,
          proposedFact: row.proposedFact,
          sourceKind: row.sourceKind,
          connectionId: row.connectionId,
          mcpServerId: row.mcpServerId,
          dataRoomItemId: row.dataRoomItemId,
          sourceItemId: row.sourceItemId,
          sourceKey: row.sourceKey,
          quote: row.quote,
          createdAt: row.createdAt.toISOString(),
        }),
      );
    },
    importEntity: (input: CompanyEntityImportInput) =>
      write((tx) => importEntity(tx, scope, input)),
    importEdge: (input: CompanyEdgeImportInput) => write((tx) => importEdge(tx, scope, input)),
    importEvent: (input: CompanyEventImportInput) => write((tx) => importEvent(tx, scope, input)),
    edit: (input: CompanyEntityEditInput) => write((tx) => editEntity(tx, scope, input)),
    editEdge: (input: CompanyEdgeEditInput) => write((tx) => editEdge(tx, scope, input)),
    editEvent: (input: CompanyEventEditInput) => write((tx) => editEvent(tx, scope, input)),
    confirm: (entityId: string) => write((tx) => confirmEntity(tx, scope, entityId)),
    confirmEdge: (edgeId: string) => write((tx) => confirmFact(tx, scope, "edge", edgeId)),
    confirmEvent: (eventId: string) => write((tx) => confirmFact(tx, scope, "event", eventId)),
    reject: (entityId: string, reason?: string) =>
      write((tx) => rejectEntity(tx, scope, entityId, reason)),
    rejectEdge: (edgeId: string, reason?: string) =>
      write((tx) => rejectFact(tx, scope, "edge", edgeId, reason)),
    rejectEvent: (eventId: string, reason?: string) =>
      write((tx) => rejectFact(tx, scope, "event", eventId, reason)),
    disconnect: (
      sourceKind: string,
      sourceItemId: string,
      sourceScope?: {
        connectionId?: string | null;
        mcpServerId?: string | null;
        dataRoomItemId?: string | null;
      },
    ) => write((tx) => disconnectSource(tx, scope, { sourceKind, sourceItemId, ...sourceScope })),
    disconnectConnection: (connectionId: string) =>
      write(async (tx) => {
        await tx.companyCandidate.deleteMany({ where: { ...scope, connectionId } });
        await tx.companyEvidence.deleteMany({
          where: { ...scope, connectionId, NOT: { sourceKind: "manual" } },
        });
      }),
    disconnectMcpServer: (mcpServerId: string) =>
      write(async (tx) => {
        await tx.companyCandidate.deleteMany({ where: { ...scope, mcpServerId } });
        await tx.companyEvidence.deleteMany({
          where: { ...scope, mcpServerId, NOT: { sourceKind: "manual" } },
        });
      }),
    erase: (entityId: string) => write((tx) => eraseEntity(tx, scope, entityId)),
    eraseMap: () => write((tx) => eraseMap(tx, scope)),
    merge: (sourceEntityId: string, survivorEntityId: string) =>
      write((tx) => mergeEntities(tx, scope, sourceEntityId, survivorEntityId)),
    split: (sourceEntityId: string) => write((tx) => splitEntity(tx, scope, sourceEntityId)),
    privacy: () => write((tx) => privacy(tx, scope)),
    sourceControl: (locator: CompanySourceLocator, connected: boolean) =>
      write((tx) => sourceControl(tx, scope, locator, connected)),
    excludePerson: (entityId: string) => write((tx) => excludePerson(tx, scope, entityId)),
    export: () =>
      write((tx) => exportMap(tx, scope), Prisma.TransactionIsolationLevel.RepeatableRead),
    visibility: (input: {
      kind: "entity" | "edge" | "event";
      id: string;
      visibility: "private" | "team";
    }) => write((tx) => setVisibility(tx, scope, input)),
    teamFacts: (text?: string) => teamFacts(prisma, scope, text),
    writer: (tx: Prisma.TransactionClient) => companyWriter(tx, actor),
  };
}
