import type { EquityDocumentLink, EquityDocumentTarget } from "@rakazo/contracts";
import {
  EquityDocumentLinkCreateInputSchema,
  EquityDocumentLinkListInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import { recordEquityAudit } from "./audit.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  EquityInputError,
  ensureLedger,
  inTransaction,
  iso,
  notFound,
  scopeOf,
} from "./ledger.js";

/** Data room documents attached to a stakeholder, a certificate or a funding round. */

const MODEL = {
  stakeholder: "equityStakeholder",
  certificate: "equityCertificate",
  round: "equityFundingRound",
} as const;

const column = (target: EquityDocumentTarget) =>
  target.kind === "stakeholder"
    ? { stakeholderId: target.id }
    : target.kind === "certificate"
      ? { certificateId: target.id }
      : { roundId: target.id };

type LinkRow = {
  id: string;
  dataRoomItemId: string;
  stakeholderId: string | null;
  certificateId: string | null;
  roundId: string | null;
  createdAt: Date;
};

async function describe(prisma: EquityDb, scope: EquityScope, rows: LinkRow[]) {
  const ids = (key: "stakeholderId" | "certificateId" | "roundId") =>
    rows.flatMap((row) => (row[key] ? [row[key]] : []));
  const [items, stakeholders, certificates, rounds] = await Promise.all([
    prisma.dataRoomItem.findMany({
      where: { ...scope, id: { in: rows.map((row) => row.dataRoomItemId) } },
      select: { id: true, name: true },
    }),
    prisma.equityStakeholder.findMany({
      where: { ...scope, id: { in: ids("stakeholderId") } },
      select: { id: true, name: true },
    }),
    prisma.equityCertificate.findMany({
      where: { ...scope, id: { in: ids("certificateId") } },
      select: { id: true, label: true },
    }),
    prisma.equityFundingRound.findMany({
      where: { ...scope, id: { in: ids("roundId") } },
      select: { id: true, name: true },
    }),
  ]);
  const names = new Map(items.map((row) => [row.id, row.name]));
  const labels = new Map<string, string>([
    ...stakeholders.map((row) => [row.id, row.name] as const),
    ...certificates.map((row) => [row.id, row.label] as const),
    ...rounds.map((row) => [row.id, row.name] as const),
  ]);
  // Links of a document deleted from the Data room are removed with it (foreign key cascade).
  return rows.flatMap((row): EquityDocumentLink[] => {
    const name = names.get(row.dataRoomItemId);
    if (name == null) return [];
    const target: EquityDocumentTarget = row.stakeholderId
      ? { kind: "stakeholder", id: row.stakeholderId }
      : row.certificateId
        ? { kind: "certificate", id: row.certificateId }
        : { kind: "round", id: row.roundId! };
    return [
      {
        id: row.id,
        dataRoomItemId: row.dataRoomItemId,
        name,
        target,
        targetLabel: labels.get(target.id) ?? "",
        createdAt: iso(row.createdAt),
      },
    ];
  });
}

export async function listEquityDocumentLinks(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDocumentLinkListInputSchema>,
) {
  const input = EquityDocumentLinkListInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const rows = await prisma.equityDocumentLink.findMany({
    where: { ...scope, ...(input.target ? column(input.target) : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return describe(prisma, scope, rows);
}

export async function createEquityDocumentLink(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDocumentLinkCreateInputSchema>,
) {
  const input = EquityDocumentLinkCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await assertInLedger(tx, scope, MODEL[input.target.kind], input.target.id);
    const item = await tx.dataRoomItem.findFirst({
      // Meeting notes stay out of the cap table, as they stay out of the portal.
      where: {
        id: input.dataRoomItemId,
        ...scope,
        storageKey: { not: null },
        source: { not: "meeting" },
      },
      select: { id: true },
    });
    if (!item) throw new EquityInputError("Unknown document");
    // The partial unique indexes make a repeat or concurrent attach a no-op.
    const data = { ...scope, dataRoomItemId: item.id, ...column(input.target) };
    const { count } = await tx.equityDocumentLink.createMany({
      data: [data],
      skipDuplicates: true,
    });
    const row = await tx.equityDocumentLink.findFirstOrThrow({ where: data });
    if (count === 1)
      await recordEquityAudit(tx, actor, {
        kind: "document.link",
        subjectType: "document_link",
        subjectId: row.id,
        after: { dataRoomItemId: item.id, target: input.target },
      });
    const [link] = await describe(tx, scope, [row]);
    return link!;
  });
}

/** Detaches a document; the Data room keeps it. */
export async function deleteEquityDocumentLink(prisma: EquityDb, actor: EquityScope, id: string) {
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const row = await tx.equityDocumentLink.findFirst({ where: { id, ...scope } });
    if (!row) throw notFound("Document link");
    // A concurrent detach deletes it first; only the one that deleted it records the change.
    const { count } = await tx.equityDocumentLink.deleteMany({ where: { id, ...scope } });
    if (count === 0) throw notFound("Document link");
    await recordEquityAudit(tx, actor, {
      kind: "document.unlink",
      subjectType: "document_link",
      subjectId: id,
      before: {
        dataRoomItemId: row.dataRoomItemId,
        stakeholderId: row.stakeholderId,
        certificateId: row.certificateId,
        roundId: row.roundId,
      },
    });
    return { ok: true as const };
  });
}
