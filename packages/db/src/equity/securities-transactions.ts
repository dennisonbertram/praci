import type { EquityCertificateTotals, EquityShareTransactionResult } from "@rakazo/contracts";
import {
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
  EquityCancelInputSchema,
  EquityCertificateListInputSchema,
  EquityConvertCertificateInputSchema,
  EquityRepurchaseInputSchema,
  EquityTransferInputSchema,
} from "@rakazo/contracts";
import { parseFixed, SCALE, sharesTimesPrice } from "@rakazo/core/equity";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  copyVestingScheduleForChild,
  EquityInputError,
  fromBig,
  inTransaction,
  lockEquityCertificates,
  lockEquityLedger,
  lockEquityPlans,
  nextLabel,
  notFound,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  toJson,
} from "./ledger.js";
import { keyColumns, replayedId } from "./request-key.js";
import { assertEquityCertificateCapacity, certificateWhere, toCertificate } from "./securities.js";

const INCLUDE = {
  stakeholder: { select: { name: true } },
  shareClass: { select: { name: true, prefix: true } },
} as const;

type SourceRow = Prisma.EquityCertificateGetPayload<{ include: typeof INCLUDE }>;
type Tx = Prisma.TransactionClient;

/** The certificate, locked to the caller's ledger and still outstanding. */
async function outstanding(tx: Tx, actor: EquityScope, id: string): Promise<SourceRow> {
  await lockEquityLedger(tx, actor);
  const hint = await tx.equityCertificate.findFirst({
    where: { id, ...scopeOf(actor) },
    select: { planId: true },
  });
  if (!hint) throw notFound("Certificate");
  await lockEquityPlans(tx, actor, hint.planId ? [hint.planId] : []);
  await lockEquityCertificates(tx, actor, [id]);
  const row = await tx.equityCertificate.findFirst({
    where: { id, ...scopeOf(actor) },
    include: INCLUDE,
  });
  if (!row) throw notFound("Certificate");
  if (!(EQUITY_OUTSTANDING_CERTIFICATE_STATUSES as readonly string[]).includes(row.status))
    throw new EquityInputError("Only an outstanding certificate can change");
  return row;
}

function part(row: SourceRow, quantity: string): bigint {
  const shares = toBig(quantity);
  if (shares > row.quantity)
    throw new EquityInputError("The quantity is more than the certificate holds");
  return shares;
}

const CONSIDERATION_FIELDS = [
  "cashPaidCents",
  "debtCanceledCents",
  "ipTransferredCents",
  "otherConsiderationCents",
] as const;
type Consideration = Record<(typeof CONSIDERATION_FIELDS)[number], bigint>;

/** The source's consideration for `quantity` of its shares (rounded down, like the cost basis). */
function considerationFor(source: SourceRow, quantity: bigint): Consideration {
  const share = (cents: bigint) => (cents * quantity) / source.quantity;
  return {
    cashPaidCents: share(source.cashPaidCents),
    debtCanceledCents: share(source.debtCanceledCents),
    ipTransferredCents: share(source.ipTransferredCents),
    otherConsiderationCents: share(source.otherConsiderationCents),
  };
}

/** What is left of the source's consideration once `taken` has gone to another certificate. */
function considerationLeft(source: SourceRow, taken: Consideration): Consideration {
  return {
    cashPaidCents: source.cashPaidCents - taken.cashPaidCents,
    debtCanceledCents: source.debtCanceledCents - taken.debtCanceledCents,
    ipTransferredCents: source.ipTransferredCents - taken.ipTransferredCents,
    otherConsiderationCents: source.otherConsiderationCents - taken.otherConsiderationCents,
  };
}

/**
 * A new certificate that carries the source's terms, with its own label, holder, class and
 * quantity. It also carries its share of the source's consideration, so cash raised per holder and
 * per class survives the transfer or split; the source keeps the record of what it was issued for.
 */
async function child(
  tx: Tx,
  actor: EquityScope,
  source: SourceRow,
  changes: {
    stakeholderId?: string;
    shareClassId?: string;
    quantity: bigint;
    issueDate: string;
    consideration: Consideration;
    costBasisCents?: bigint | null;
  },
): Promise<string> {
  const shareClassId = changes.shareClassId ?? source.shareClassId;
  if (source.planId) {
    const plan = await tx.equityPlan.findFirst({
      where: { id: source.planId, ...scopeOf(actor) },
      select: { shareClassId: true },
    });
    if (!plan || plan.shareClassId !== shareClassId)
      throw new EquityInputError("The certificate's plan does not support the target share class");
  }
  const prefix =
    shareClassId === source.shareClassId
      ? source.shareClass.prefix
      : ((
          await tx.equityShareClass.findFirst({
            where: { id: shareClassId, ...scopeOf(actor) },
            select: { prefix: true },
          })
        )?.prefix ?? null);
  if (!prefix) throw new EquityInputError("Unknown share class");
  const vestingScheduleId = changes.stakeholderId
    ? null
    : await copyVestingScheduleForChild(
        tx,
        actor,
        source.vestingScheduleId,
        changes.quantity,
        source.quantity,
      );
  const row = await tx.equityCertificate.create({
    data: {
      ...scopeOf(actor),
      label: await nextLabel(tx, actor, "equityCertificate", prefix),
      stakeholderId: changes.stakeholderId ?? source.stakeholderId,
      shareClassId,
      planId: source.planId,
      status: "outstanding",
      acceptanceStatus: source.acceptanceStatus,
      paperStatus: source.paperStatus,
      quantity: changes.quantity,
      pricePerShare: source.pricePerShare,
      pricePaidPerShare: source.pricePaidPerShare,
      ...changes.consideration,
      costBasisCents:
        changes.costBasisCents === undefined ? source.costBasisCents : changes.costBasisCents,
      issueDate: toDate(changes.issueDate),
      originalAcquisitionDate: source.originalAcquisitionDate ?? source.issueDate,
      issuedBy: source.issuedBy,
      boardApprovedOn: source.boardApprovedOn,
      rule144Date: source.rule144Date,
      federalExemption: source.federalExemption,
      stateExemption: source.stateExemption,
      stateOfResidency: source.stateOfResidency,
      legend: source.legend,
      personnel: changes.stakeholderId ? toJson(null) : toJson(source.personnel),
      collateralized: source.collateralized,
      vestingScheduleId,
      parentId: source.id,
      roundId: source.roundId,
    },
    select: { id: true },
  });
  return row.id;
}

function basisFor(source: SourceRow, quantity: bigint): bigint | null {
  return source.costBasisCents === null
    ? null
    : (source.costBasisCents * quantity) / source.quantity;
}

async function close(
  tx: Tx,
  actor: EquityScope,
  source: SourceRow,
  record: {
    kind: "transfer" | "repurchase" | "cancel" | "convert";
    status: string;
    effectiveDate: string;
    quantity: bigint;
    reason: string | null;
    valueCents: bigint | null;
    note?: string;
    resulting: string[];
    disposedCostBasisCents?: bigint | null;
    key?: ReturnType<typeof keyColumns>;
  },
): Promise<EquityShareTransactionResult> {
  const before = toCertificate(source);
  const updated = await tx.equityCertificate.update({
    where: { id: source.id },
    data: {
      status: record.status,
      ...(record.kind === "cancel" ? { canceledOn: toDate(record.effectiveDate) } : {}),
    },
    include: INCLUDE,
  });
  const resulting = await tx.equityCertificate.findMany({
    where: { id: { in: record.resulting }, ...scopeOf(actor) },
    include: INCLUDE,
    orderBy: { label: "asc" },
  });
  const transactionId = await recordTransaction(tx, actor, {
    kind: record.kind,
    effectiveDate: record.effectiveDate,
    reason: record.reason,
    certificateId: source.id,
    planId: source.planId,
    quantity: record.quantity,
    valueCents: record.valueCents,
    before,
    after: {
      ...toCertificate(updated),
      disposedCostBasisCents: record.disposedCostBasisCents?.toString() ?? null,
      resultingCertificates: resulting.map(toCertificate),
    },
    resulting: record.resulting,
    note: record.note ?? null,
    ...record.key,
  });
  return { transactionId, kind: record.kind, resulting: resulting.map(toCertificate) };
}

/** Price per share times shares in cents, rounded half-up like every other price x shares figure. */
export function value(pricePerShare: string | undefined, quantity: bigint): bigint | null {
  if (pricePerShare == null) return null;
  return sharesTimesPrice(quantity, parseFixed(pricePerShare));
}

export async function transferEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityTransferInputSchema>,
): Promise<EquityShareTransactionResult> {
  const input = EquityTransferInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityTransaction.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay) return replayedTransfer(tx, scope, replay);
    const source = await outstanding(tx, scope, input.certificateId);
    await assertInLedger(tx, scope, "equityStakeholder", input.toStakeholderId);
    if (input.toStakeholderId === source.stakeholderId)
      throw new EquityInputError("Transfer to a different stakeholder");
    const shares = part(source, input.quantity);
    const moved = considerationFor(source, shares);
    const resulting = [
      await child(tx, scope, source, {
        stakeholderId: input.toStakeholderId,
        quantity: shares,
        issueDate: input.effectiveDate,
        consideration: moved,
        costBasisCents: basisFor(source, shares),
      }),
    ];
    if (shares < source.quantity)
      resulting.push(
        await child(tx, scope, source, {
          quantity: source.quantity - shares,
          issueDate: input.effectiveDate,
          consideration: considerationLeft(source, moved),
          costBasisCents:
            source.costBasisCents === null
              ? null
              : source.costBasisCents - (basisFor(source, shares) ?? 0n),
        }),
      );
    return close(tx, scope, source, {
      kind: "transfer",
      status: "transferred",
      effectiveDate: input.effectiveDate,
      quantity: shares,
      reason: input.reason,
      valueCents: value(input.pricePerShare, shares),
      note: input.note,
      resulting,
      disposedCostBasisCents: basisFor(source, shares),
      key: keyColumns(input),
    });
  });
}

/** The result of the transfer that an earlier request with the same key made. */
async function replayedTransfer(
  tx: Tx,
  actor: EquityScope,
  transactionId: string,
): Promise<EquityShareTransactionResult> {
  const row = await tx.equityTransaction.findFirstOrThrow({
    where: { id: transactionId, ...scopeOf(actor) },
    select: { resulting: true },
  });
  const resulting = await tx.equityCertificate.findMany({
    where: { id: { in: row.resulting as string[] }, ...scopeOf(actor) },
    include: INCLUDE,
    orderBy: { label: "asc" },
  });
  return { transactionId, kind: "transfer", resulting: resulting.map(toCertificate) };
}

async function reduce(
  prisma: EquityDb,
  actor: EquityScope,
  input: {
    certificateId: string;
    quantity: string;
    effectiveDate: string;
    reason: string;
    note?: string;
    pricePerShare?: string;
  },
  kind: "repurchase" | "cancel",
): Promise<EquityShareTransactionResult> {
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const source = await outstanding(tx, scope, input.certificateId);
    const shares = part(source, input.quantity);
    const disposedCostBasisCents = basisFor(source, shares);
    const resulting =
      shares < source.quantity
        ? [
            await child(tx, scope, source, {
              quantity: source.quantity - shares,
              issueDate: input.effectiveDate,
              consideration: considerationLeft(source, considerationFor(source, shares)),
              costBasisCents:
                source.costBasisCents === null
                  ? null
                  : source.costBasisCents - (disposedCostBasisCents ?? 0n),
            }),
          ]
        : [];
    return close(tx, scope, source, {
      kind,
      status: kind === "repurchase" ? "repurchased" : "canceled",
      effectiveDate: input.effectiveDate,
      quantity: shares,
      reason: input.reason,
      valueCents: value(input.pricePerShare, shares),
      note: input.note,
      resulting,
      disposedCostBasisCents,
    });
  });
}

export async function repurchaseEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityRepurchaseInputSchema>,
): Promise<EquityShareTransactionResult> {
  return reduce(prisma, actor, EquityRepurchaseInputSchema.parse(raw), "repurchase");
}

export async function cancelEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCancelInputSchema>,
): Promise<EquityShareTransactionResult> {
  return reduce(prisma, actor, EquityCancelInputSchema.parse(raw), "cancel");
}

export async function convertEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertCertificateInputSchema>,
): Promise<EquityShareTransactionResult> {
  const input = EquityConvertCertificateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const source = await outstanding(tx, scope, input.certificateId);
    await assertInLedger(tx, scope, "equityShareClass", input.toShareClassId);
    if (input.toShareClassId === source.shareClassId)
      throw new EquityInputError("Convert to a different share class");
    const scaledShares = source.quantity * parseFixed(input.ratio);
    if (scaledShares % SCALE !== 0n)
      throw new EquityInputError("A certificate conversion cannot create fractional shares");
    const shares = scaledShares / SCALE;
    if (shares <= 0n) throw new EquityInputError("The conversion leaves no shares");
    await assertEquityCertificateCapacity(
      tx,
      scope,
      input.toShareClassId,
      shares,
      undefined,
      input.effectiveDate,
    );
    const resulting = [
      await child(tx, scope, source, {
        shareClassId: input.toShareClassId,
        quantity: shares,
        issueDate: input.effectiveDate,
        consideration: considerationFor(source, source.quantity),
      }),
    ];
    return close(tx, scope, source, {
      kind: "convert",
      status: "converted",
      effectiveDate: input.effectiveDate,
      quantity: source.quantity,
      reason: null,
      valueCents: null,
      note: input.note,
      resulting,
    });
  });
}

/** The count and share total of every certificate a ledger filter matches (not just one page). */
export async function equityCertificateTotals(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCertificateListInputSchema>,
): Promise<EquityCertificateTotals> {
  const where = certificateWhere(scopeOf(actor), EquityCertificateListInputSchema.parse(raw));
  const totals = await prisma.equityCertificate.aggregate({
    where,
    _count: { _all: true },
    _sum: { quantity: true },
  });
  return { count: totals._count._all, shares: fromBig(totals._sum.quantity ?? 0n) };
}
