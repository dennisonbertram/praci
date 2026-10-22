import type {
  CapTableSnapshot,
  CapTableSnapshotInput,
  CapTableSource,
  CapTableSourceRef,
} from "@rakazo/contracts";
import { CapTableSnapshotInputSchema, CapTableSourceSchema } from "@rakazo/contracts";
import * as z from "zod";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "capTableSnapshot">;
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });

/** A write came from a source that no longer owns the table, or from a stale copy of it. */
export class CapTableSourceError extends Error {
  constructor() {
    super("The cap table changed elsewhere");
    this.name = "CapTableSourceError";
  }
}

const PreviousSchema = z.object({
  source: CapTableSourceSchema,
  sourceRef: z.unknown(),
  data: z.unknown(),
});

/** The user's cap table snapshot, or null before the first sync. The source comes from its column. */
export async function getCapTableSnapshot(
  prisma: Db,
  actor: Scope,
): Promise<CapTableSnapshot | null> {
  const row = await prisma.capTableSnapshot.findUnique({
    where: { spaceId_userId: ownerOf(actor) },
  });
  if (!row) return null;
  const data = CapTableSnapshotInputSchema.safeParse(row.data);
  const source = CapTableSourceSchema.safeParse(row.source);
  return data.success && source.success
    ? {
        ...data.data,
        source: source.data,
        updatedAt: row.updatedAt.toISOString(),
        canUndo: PreviousSchema.safeParse(row.previous).success,
      }
    : null;
}

/**
 * Validates the input and replaces the user's snapshot. The input's own `source` (default carta)
 * is the writer it expects: the write is refused with CapTableSourceError when the row has another
 * source, in one conditional update, so a late write cannot land. With `loadedAt` (a typed-in
 * table saved whole) it is also refused when the row changed since that copy was loaded. A sheet write must also name the stored file id and have a holder. Only
 * Carta may create the first row; the other sources start through changeCapTableSource.
 * A typed-in save (with `loadedAt`) clears the one-step Undo; a write by the new source keeps it. Throws a ZodError for invalid input.
 */
export async function saveCapTableSnapshot(
  prisma: Db,
  actor: Scope,
  input: CapTableSnapshotInput,
  options: { loadedAt?: string } = {},
): Promise<void> {
  const { source, ...data } = CapTableSnapshotInputSchema.parse(input);
  const scope = ownerOf(actor);
  // A sheet read must name the file the founder chose and bring at least one holder; the file id
  // is compared with the stored one in the same conditional update below.
  if (source === "sheet" && (!data.sourceRef || data.holders.length === 0))
    throw new CapTableSourceError();
  const written = await prisma.capTableSnapshot.updateMany({
    where: {
      ...scope,
      source,
      ...(source === "sheet"
        ? { data: { path: ["sourceRef", "driveFileId"], equals: data.sourceRef?.driveFileId } }
        : {}),
      ...(options.loadedAt ? { updatedAt: new Date(options.loadedAt) } : {}),
    },
    // A typed-in save is the founder's next change and clears Undo. A write by the new source
    // (the Carta read a switch starts) keeps it, so the switch can still be undone.
    data: options.loadedAt ? { data, previous: Prisma.DbNull } : { data },
  });
  if (written.count) return;
  const exists = await prisma.capTableSnapshot.findUnique({
    where: { spaceId_userId: scope },
    select: { id: true },
  });
  if (exists || source !== "carta") throw new CapTableSourceError();
  try {
    await prisma.capTableSnapshot.create({ data: { ...scope, source, data } });
  } catch (error) {
    // A first write from another request won the unique index.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new CapTableSourceError();
    throw error;
  }
}

/**
 * Makes `source` the table's writer at once and keeps the data. The row's old source, source
 * reference and table are copied into `previous` so Undo can restore them once. With no row yet
 * an empty table is created under the company name. Choosing the source already set does nothing.
 */
export async function changeCapTableSource(
  prisma: Db,
  actor: Scope,
  input: { source: CapTableSource; sourceRef?: CapTableSourceRef | null; companyName: string },
): Promise<void> {
  const scope = ownerOf(actor);
  const sourceRef = input.sourceRef ?? null;
  const row = await prisma.capTableSnapshot.findUnique({ where: { spaceId_userId: scope } });
  if (!row) {
    const empty = CapTableSnapshotInputSchema.parse({
      companyName: input.companyName,
      asOf: new Date().toISOString().slice(0, 10),
      fullyDilutedShares: 0,
      sourceRef,
      shareClasses: [],
      holders: [],
    });
    const { source: _source, ...data } = empty;
    await prisma.capTableSnapshot.create({ data: { ...scope, source: input.source, data } });
    return;
  }
  if (row.source === input.source && !input.sourceRef) return;
  const { source: _source, ...old } = CapTableSnapshotInputSchema.parse(row.data);
  const stored = { ...old, sourceRef };
  const changed = await prisma.capTableSnapshot.updateMany({
    where: { ...scope, source: row.source, updatedAt: row.updatedAt },
    data: {
      source: input.source,
      data: stored,
      previous: {
        source: row.source,
        sourceRef: old.sourceRef,
        data: row.data,
      },
    },
  });
  if (!changed.count) throw new CapTableSourceError();
}

/** Restores the table before the last source switch, once. False when there is nothing to restore. */
export async function undoCapTableSource(prisma: Db, actor: Scope): Promise<boolean> {
  const scope = ownerOf(actor);
  const row = await prisma.capTableSnapshot.findUnique({ where: { spaceId_userId: scope } });
  const previous = PreviousSchema.safeParse(row?.previous);
  if (!row || !previous.success) return false;
  const restored = await prisma.capTableSnapshot.updateMany({
    where: { ...scope, source: row.source, updatedAt: row.updatedAt },
    data: {
      source: previous.data.source,
      data: previous.data.data as Prisma.InputJsonObject,
      previous: Prisma.DbNull,
    },
  });
  return restored.count > 0;
}
