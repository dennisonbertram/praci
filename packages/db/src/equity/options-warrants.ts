import type { EquityWarrant, EquityWarrantPageSchema } from "@rakazo/contracts";
import {
  EquityWarrantCancelInputSchema,
  EquityWarrantCreateInputSchema,
  EquityWarrantListInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  contains,
  EquityConflictError,
  ensureLedger,
  fromBig,
  fromDate,
  fromDateOrNull,
  fromDecimal,
  inTransaction,
  iso,
  lockEquityLedger,
  nextLabel,
  notFound,
  pageArgs,
  pageOf,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  toDateOrNull,
  toDecimal,
  withConflict,
} from "./ledger.js";
import { keyColumns, replayedId } from "./request-key.js";

const include = {
  stakeholder: { select: { name: true } },
  shareClass: { select: { name: true } },
} as const;
type WarrantRow = Prisma.EquityWarrantGetPayload<{ include: typeof include }>;

const toWarrant = (row: WarrantRow): EquityWarrant => ({
  id: row.id,
  label: row.label,
  stakeholderId: row.stakeholderId,
  stakeholderName: row.stakeholder.name,
  shareClassId: row.shareClassId,
  shareClassName: row.shareClass.name,
  quantity: fromBig(row.quantity),
  exercisePrice: fromDecimal(row.exercisePrice),
  issueDate: fromDate(row.issueDate),
  expirationDate: fromDateOrNull(row.expirationDate),
  status: row.status as EquityWarrant["status"],
  canceledOn: fromDateOrNull(row.canceledOn),
  adminNotes: row.adminNotes,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

export async function getEquityWarrant(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityWarrant> {
  const row = await prisma.equityWarrant.findFirst({ where: { id, ...scopeOf(actor) }, include });
  if (!row) throw notFound("Warrant");
  return toWarrant(row);
}

export async function listEquityWarrants(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityWarrantListInputSchema>,
): Promise<z.infer<typeof EquityWarrantPageSchema>> {
  const input = EquityWarrantListInputSchema.parse(raw);
  const search = contains(input.search);
  const where: Prisma.EquityWarrantWhereInput = {
    ...scopeOf(actor),
    ...(input.status?.length ? { status: { in: input.status } } : {}),
    ...(search ? { OR: [{ label: search }, { stakeholder: { name: search } }] } : {}),
  };
  const sort = input.sort ?? { field: "issueDate", dir: "desc" as const };
  const [rows, total] = await Promise.all([
    prisma.equityWarrant.findMany({
      where,
      include,
      orderBy: [{ [sort.field]: sort.dir }, { id: "asc" }],
      ...pageArgs(input),
    }),
    prisma.equityWarrant.count({ where }),
  ]);
  return pageOf(rows.map(toWarrant), total, input);
}

/** Issues a warrant with the next free W- label. */
export async function createEquityWarrant(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityWarrantCreateInputSchema>,
): Promise<EquityWarrant> {
  const input = EquityWarrantCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityWarrant.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay) return replay;
    await assertInLedger(tx, scope, "equityStakeholder", input.stakeholderId);
    await assertInLedger(tx, scope, "equityShareClass", input.shareClassId);
    const label = await nextLabel(tx, scope, "equityWarrant", "W");
    const row = await withConflict("A warrant with this label exists", () =>
      tx.equityWarrant.create({
        data: {
          ...scope,
          label,
          stakeholderId: input.stakeholderId,
          shareClassId: input.shareClassId,
          quantity: toBig(input.quantity),
          exercisePrice: toDecimal(input.exercisePrice),
          issueDate: toDate(input.issueDate),
          expirationDate: toDateOrNull(input.expirationDate) ?? null,
          adminNotes: input.adminNotes ?? null,
          ...keyColumns(input),
        },
        include,
      }),
    );
    await recordTransaction(tx, scope, {
      kind: "issue",
      effectiveDate: input.issueDate,
      quantity: row.quantity,
      after: toWarrant(row),
      note: "warrant",
    });
    return row.id;
  });
  return getEquityWarrant(prisma, scope, id);
}

/** Cancels an outstanding warrant; the record stays readable. */
export async function cancelEquityWarrant(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityWarrantCancelInputSchema>,
): Promise<EquityWarrant> {
  const input = EquityWarrantCancelInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    const row = await tx.equityWarrant.findFirst({ where: { id: input.id, ...scope }, include });
    if (!row) throw notFound("Warrant");
    if (row.status !== "outstanding")
      throw new EquityConflictError("Only an outstanding warrant can be canceled");
    const updated = await tx.equityWarrant.update({
      where: { id: row.id },
      data: { status: "canceled", canceledOn: toDate(input.canceledOn) },
      include,
    });
    await recordTransaction(tx, scope, {
      kind: "cancel",
      effectiveDate: input.canceledOn,
      quantity: row.quantity,
      before: toWarrant(row),
      after: toWarrant(updated),
      note: input.note ?? "warrant",
    });
  });
  return getEquityWarrant(prisma, scope, input.id);
}
