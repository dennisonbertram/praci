import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { IsolationError } from "./scope.js";

export type LegalContractRecord = Prisma.LegalContractGetPayload<object>;
export type LegalDeadlineRecord = Prisma.LegalDeadlineGetPayload<object>;
export type LegalNodeRecord = Prisma.LegalNodeGetPayload<object>;
export type LegalEdgeRecord = Prisma.LegalEdgeGetPayload<object>;

/** A document the agent looked at and found is not legal: kept so it is not offered again, never listed. */
export const LEGAL_NOT_LEGAL_TYPE = "not_legal";

const MAX_LIST = 500;
const MAX_GRAPH_NODES = 2000;

const scope = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });
const clamp = (n: number | undefined, fallback: number, max: number) =>
  Math.min(Math.max(Math.trunc(n ?? fallback), 1), max);

/** "YYYY-MM-DD" to a UTC date, or null when it is not a real calendar day. */
export function parseLegalDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : date;
}

/** Lower-case words joined by single spaces, so "Acme, Inc." and "ACME Inc" are the same node. */
export function legalNodeKey(label: string): string {
  return label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const relationOf = (relation: string) =>
  relation
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export interface LegalContractInput {
  dataRoomItemId: string;
  /** DataRoomItem.revision the agent read. Stored as given, so a document that changed since stays unreviewed. */
  revision: number;
  title: string;
  contractType: string;
  counterparties?: string[];
  status: string;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  autoRenews?: boolean | null;
  renewalNoticeDays?: number | null;
  governingLaw?: string | null;
  valueCents?: bigint | null;
  currency?: string | null;
  summary?: string | null;
}

export interface LegalDeadlineInput {
  id?: string;
  contractId?: string | null;
  dataRoomItemId?: string | null;
  title: string;
  dueDate: Date;
  kind: string;
  status?: string;
  /** True for deadlines opened from a contract's dates. */
  derived?: boolean;
  sourceQuote?: string | null;
  notes?: string | null;
}

/** Every query is keyed by the actor's space and user, like the Data Room. */
export function createLegalRepos(prisma: PrismaClient) {
  async function requireContract(actor: Actor, id: string) {
    const row = await prisma.legalContract.findFirst({ where: { id, ...scope(actor) } });
    if (!row) throw new IsolationError();
    return row;
  }
  async function requireNode(actor: Actor, id: string) {
    const row = await prisma.legalNode.findFirst({ where: { id, ...scope(actor) } });
    if (!row) throw new IsolationError();
    return row;
  }

  /** Ready Data Room items with no analysis yet, or analyzed at an older revision. */
  const unreviewedCondition = (actor: Actor, excludeConnectionIds: readonly string[] = []) => Prisma.sql`
    FROM data_room_items i
    LEFT JOIN legal_contracts c
      ON c."dataRoomItemId" = i.id AND c."spaceId" = i."spaceId" AND c."userId" = i."userId"
    WHERE i."spaceId" = ${actor.spaceId} AND i."userId" = ${actor.userId} AND i.status = 'ready'
      AND (c.id IS NULL OR i.revision > c."analyzedRevision")
      ${
        excludeConnectionIds.length
          ? Prisma.sql`AND (i."sourceConnectionId" IS NULL OR NOT (i."sourceConnectionId" = ANY(${[...excludeConnectionIds]})))`
          : Prisma.empty
      }`;

  return {
    /** `excludeConnectionIds`: connections the user denied the agent; their items are not listed. */
    async unreviewedItems(actor: Actor, limit?: number, excludeConnectionIds?: readonly string[]) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT i.id ${unreviewedCondition(actor, excludeConnectionIds)}
        ORDER BY i."createdAt" DESC, i.id ASC LIMIT ${clamp(limit, 25, 100)}`;
      const items = await prisma.dataRoomItem.findMany({
        where: { id: { in: rows.map((row) => row.id) }, ...scope(actor) },
        select: {
          id: true,
          name: true,
          mimeType: true,
          source: true,
          docType: true,
          docDate: true,
          parties: true,
          summary: true,
          revision: true,
        },
      });
      const byId = new Map(items.map((item) => [item.id, item]));
      return rows.flatMap((row) => byId.get(row.id) ?? []);
    },

    async countUnreviewed(actor: Actor, excludeConnectionIds?: readonly string[]): Promise<number> {
      const [row] = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n ${unreviewedCondition(actor, excludeConnectionIds)}`;
      return Number(row?.n ?? 0);
    },

    /** Creates or replaces the analysis of one item and records the revision it was made at. */
    async upsertContract(actor: Actor, input: LegalContractInput): Promise<LegalContractRecord> {
      const item = await prisma.dataRoomItem.findFirst({
        where: { id: input.dataRoomItemId, ...scope(actor) },
        select: { id: true },
      });
      if (!item) throw new IsolationError();
      const data = {
        title: input.title,
        contractType: input.contractType,
        counterparties: input.counterparties ?? [],
        status: input.status,
        effectiveDate: input.effectiveDate ?? null,
        expirationDate: input.expirationDate ?? null,
        autoRenews: input.autoRenews ?? null,
        renewalNoticeDays: input.renewalNoticeDays ?? null,
        governingLaw: input.governingLaw ?? null,
        valueCents: input.valueCents ?? null,
        currency: input.currency ?? null,
        summary: input.summary ?? null,
        analyzedRevision: input.revision,
        analyzedAt: new Date(),
      };
      return prisma.legalContract.upsert({
        where: {
          spaceId_userId_dataRoomItemId: { ...scope(actor), dataRoomItemId: input.dataRoomItemId },
        },
        create: { ...scope(actor), dataRoomItemId: input.dataRoomItemId, ...data },
        update: data,
      });
    },

    listContracts: (actor: Actor, options: { limit?: number } = {}) =>
      prisma.legalContract.findMany({
        where: { ...scope(actor), contractType: { not: LEGAL_NOT_LEGAL_TYPE } },
        orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
        take: clamp(options.limit, 200, MAX_LIST),
      }),

    getContract: (actor: Actor, id: string) => requireContract(actor, id),

    /**
     * Creates a deadline, or updates it: by id when given, else the open or closed one with the same
     * contract, kind, day and title, so analyzing a document again does not duplicate its dates.
     */
    async upsertDeadline(actor: Actor, input: LegalDeadlineInput): Promise<LegalDeadlineRecord> {
      if (input.contractId) await requireContract(actor, input.contractId);
      if (input.dataRoomItemId) {
        const item = await prisma.dataRoomItem.findFirst({
          where: { id: input.dataRoomItemId, ...scope(actor) },
          select: { id: true },
        });
        if (!item) throw new IsolationError();
      }
      const data = {
        title: input.title,
        dueDate: input.dueDate,
        kind: input.kind,
        ...(input.contractId !== undefined ? { contractId: input.contractId } : {}),
        ...(input.dataRoomItemId !== undefined ? { dataRoomItemId: input.dataRoomItemId } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.derived !== undefined ? { derived: input.derived } : {}),
        ...(input.sourceQuote !== undefined ? { sourceQuote: input.sourceQuote } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      };
      let existingId = input.id;
      if (existingId) {
        const owned = await prisma.legalDeadline.findFirst({
          where: { id: existingId, ...scope(actor) },
          select: { id: true },
        });
        if (!owned) throw new IsolationError();
      } else {
        existingId = (
          await prisma.legalDeadline.findFirst({
            where: {
              ...scope(actor),
              contractId: input.contractId ?? null,
              kind: input.kind,
              dueDate: input.dueDate,
              title: input.title,
            },
            select: { id: true },
          })
        )?.id;
      }
      return existingId
        ? prisma.legalDeadline.update({ where: { id: existingId }, data })
        : prisma.legalDeadline.create({ data: { ...scope(actor), ...data } });
    },

    async updateDeadline(
      actor: Actor,
      id: string,
      patch: { status?: string; notes?: string | null },
    ): Promise<LegalDeadlineRecord> {
      const { count } = await prisma.legalDeadline.updateMany({
        where: { id, ...scope(actor) },
        data: {
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        },
      });
      if (!count) throw new IsolationError();
      return prisma.legalDeadline.findFirstOrThrow({ where: { id, ...scope(actor) } });
    },

    listDeadlines: (
      actor: Actor,
      options: {
        status?: string;
        contractId?: string;
        from?: Date;
        to?: Date;
        limit?: number;
      } = {},
    ) =>
      prisma.legalDeadline.findMany({
        where: {
          ...scope(actor),
          ...(options.status ? { status: options.status } : {}),
          ...(options.contractId ? { contractId: options.contractId } : {}),
          ...(options.from || options.to
            ? { dueDate: { gte: options.from, lte: options.to } }
            : {}),
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: clamp(options.limit, 200, MAX_LIST),
      }),

    /** Creates the node, or returns the existing one with the same kind and normalized label. */
    async upsertNode(
      actor: Actor,
      input: {
        kind: string;
        label: string;
        attrs?: Prisma.InputJsonObject | null;
        contractId?: string | null;
      },
    ): Promise<LegalNodeRecord> {
      const key = legalNodeKey(input.label);
      if (!key) throw new Error("A node needs a label");
      if (input.contractId) await requireContract(actor, input.contractId);
      const update = {
        ...(input.attrs ? { attrs: input.attrs } : {}),
        ...(input.contractId !== undefined ? { contractId: input.contractId } : {}),
      };
      return prisma.legalNode.upsert({
        where: { spaceId_userId_kind_key: { ...scope(actor), kind: input.kind, key } },
        create: {
          ...scope(actor),
          kind: input.kind,
          label: input.label,
          key,
          ...update,
        },
        update,
      });
    },

    /** Adds the edge, or updates its source when the same relation already links the two nodes. */
    async link(
      actor: Actor,
      input: {
        fromId: string;
        toId: string;
        relation: string;
        dataRoomItemId?: string | null;
        sourceQuote?: string | null;
      },
    ): Promise<LegalEdgeRecord> {
      const relation = relationOf(input.relation);
      if (!relation) throw new Error("An edge needs a relation");
      await Promise.all([requireNode(actor, input.fromId), requireNode(actor, input.toId)]);
      if (input.dataRoomItemId) {
        const item = await prisma.dataRoomItem.findFirst({
          where: { id: input.dataRoomItemId, ...scope(actor) },
          select: { id: true },
        });
        if (!item) throw new IsolationError();
      }
      const source = {
        ...(input.dataRoomItemId !== undefined ? { dataRoomItemId: input.dataRoomItemId } : {}),
        ...(input.sourceQuote !== undefined ? { sourceQuote: input.sourceQuote } : {}),
      };
      return prisma.legalEdge.upsert({
        where: { fromId_toId_relation: { fromId: input.fromId, toId: input.toId, relation } },
        create: { ...scope(actor), fromId: input.fromId, toId: input.toId, relation, ...source },
        update: source,
      });
    },

    async graph(actor: Actor) {
      const nodes = await prisma.legalNode.findMany({
        where: scope(actor),
        orderBy: [{ kind: "asc" }, { label: "asc" }, { id: "asc" }],
        take: MAX_GRAPH_NODES,
      });
      const edges = await prisma.legalEdge.findMany({
        where: {
          ...scope(actor),
          fromId: { in: nodes.map((node) => node.id) },
          toId: { in: nodes.map((node) => node.id) },
        },
        orderBy: { id: "asc" },
      });
      return { nodes, edges };
    },

    /** A node (by id, or by kind and label) with the edges touching it and the nodes at their other ends. */
    async neighborhood(actor: Actor, ref: { id?: string; kind?: string; label?: string }) {
      const node = ref.id
        ? await prisma.legalNode.findFirst({ where: { id: ref.id, ...scope(actor) } })
        : ref.label
          ? await prisma.legalNode.findFirst({
              where: {
                ...scope(actor),
                key: legalNodeKey(ref.label),
                ...(ref.kind ? { kind: ref.kind } : {}),
              },
              orderBy: { id: "asc" },
            })
          : null;
      if (!node) return null;
      const edges = await prisma.legalEdge.findMany({
        where: { ...scope(actor), OR: [{ fromId: node.id }, { toId: node.id }] },
        orderBy: { id: "asc" },
        take: MAX_LIST,
      });
      const ids = new Set(edges.flatMap((edge) => [edge.fromId, edge.toId]));
      ids.delete(node.id);
      const others = await prisma.legalNode.findMany({
        where: { id: { in: [...ids] }, ...scope(actor) },
      });
      return { node, edges, nodes: others };
    },

    async deadlineCounts(actor: Actor, today: Date) {
      const open = { ...scope(actor), status: "open" };
      const [openDeadlines, overdueDeadlines] = await Promise.all([
        prisma.legalDeadline.count({ where: open }),
        prisma.legalDeadline.count({ where: { ...open, dueDate: { lt: today } } }),
      ]);
      return { openDeadlines, overdueDeadlines };
    },
  };
}
