import type { EquityCashRaised } from "@rakazo/contracts";
import { EquityCashRaisedInputSchema, EquityRoundAttachInputSchema } from "@rakazo/contracts";
import { considerationCents } from "@rakazo/core/equity";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  EquityInputError,
  fromBig,
  fromDate,
  inTransaction,
  recordTransaction,
  scopeOf,
  today,
} from "./ledger.js";
import {
  loadCertificateHistory,
  newMoneyCertificates,
  raisedConvertibles,
} from "./views-raised.js";

/**
 * Cash raised as of a date: by share class (in order of first issue, convertibles last), by
 * holder, and per security, by the rule in core `raisedCents`: cash paid for newly issued shares
 * and convertible principal; transfers, splits, conversions and canceled securities are not new
 * money. Its total is the overview's amount raised and the sum of the rounds' cash raised.
 */
export async function equityCashRaised(
  prisma: EquityDb,
  actor: EquityScope,
  rawInput: unknown = {},
): Promise<EquityCashRaised> {
  const input = EquityCashRaisedInputSchema.parse(rawInput);
  const scope = scopeOf(actor);
  const asOf = input.asOf ?? today();
  const by = { lte: new Date(`${asOf}T00:00:00.000Z`) };
  const [allCertificates, allConvertibles, history] = await Promise.all([
    prisma.equityCertificate.findMany({
      where: { ...scope, issueDate: by },
      include: { stakeholder: { select: { name: true } }, shareClass: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    prisma.equityConvertible.findMany({
      where: { ...scope, issueDate: by },
      include: { stakeholder: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    loadCertificateHistory(prisma, scope),
  ]);
  // The one rule in views-raised.ts.
  const certificates = newMoneyCertificates(allCertificates, history, asOf);
  const convertibles = raisedConvertibles(allConvertibles, asOf);
  const classes = new Map<string, { name: string; cents: bigint }>();
  const holders = new Map<string, { name: string; cents: bigint }>();
  const addHolder = (id: string, name: string, cents: bigint) => {
    const entry = holders.get(id) ?? { name, cents: 0n };
    entry.cents += cents;
    holders.set(id, entry);
  };
  for (const row of certificates) {
    const entry = classes.get(row.shareClassId) ?? { name: row.shareClass.name, cents: 0n };
    const paid = considerationCents(row);
    entry.cents += paid;
    classes.set(row.shareClassId, entry);
    addHolder(row.stakeholderId, row.stakeholder.name, paid);
  }
  let convertibleCents = 0n;
  for (const row of convertibles) {
    convertibleCents += row.principalCents;
    addHolder(row.stakeholderId, row.stakeholder.name, row.principalCents);
  }
  const total = [...classes.values()].reduce((sum, row) => sum + row.cents, 0n) + convertibleCents;
  return {
    asOf,
    totalCents: fromBig(total),
    byClass: [
      ...[...classes.entries()].map(([id, row]) => ({
        shareClassId: id,
        name: row.name,
        cashRaisedCents: fromBig(row.cents),
      })),
      ...(convertibles.length
        ? [
            {
              shareClassId: null,
              name: "Convertibles",
              cashRaisedCents: fromBig(convertibleCents),
            },
          ]
        : []),
    ],
    byHolder: [...holders.entries()]
      .sort(([, a], [, b]) =>
        b.cents > a.cents ? 1 : b.cents < a.cents ? -1 : a.name.localeCompare(b.name),
      )
      .map(([id, row]) => ({
        stakeholderId: id,
        name: row.name,
        cashRaisedCents: fromBig(row.cents),
      })),
    securities: [
      ...certificates.map((row) => ({
        kind: "certificate" as const,
        id: row.id,
        label: row.label,
        stakeholderId: row.stakeholderId,
        stakeholderName: row.stakeholder.name,
        roundId: row.roundId,
        issueDate: fromDate(row.issueDate),
        cashPaidCents: fromBig(row.cashPaidCents),
        debtCanceledCents: fromBig(row.debtCanceledCents),
        ipTransferredCents: fromBig(row.ipTransferredCents),
        otherConsiderationCents: fromBig(row.otherConsiderationCents),
        shares: fromBig(row.quantity),
      })),
      ...convertibles.map((row) => ({
        kind: "convertible" as const,
        id: row.id,
        label: row.label,
        stakeholderId: row.stakeholderId,
        stakeholderName: row.stakeholder.name,
        roundId: row.roundId,
        issueDate: fromDate(row.issueDate),
        cashPaidCents: fromBig(row.principalCents),
        debtCanceledCents: "0",
        ipTransferredCents: "0",
        otherConsiderationCents: "0",
        shares: "0",
      })),
    ].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || a.id.localeCompare(b.id)),
  };
}

/** Puts securities in a round (or, with roundId null, out of their round), one modify row each. */
export async function attachEquityToRound(prisma: EquityDb, actor: EquityScope, rawInput: unknown) {
  const input = EquityRoundAttachInputSchema.parse(rawInput);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await assertInLedger(tx, scope, "equityFundingRound", input.roundId);
    const [certificates, convertibles] = await Promise.all([
      tx.equityCertificate.findMany({
        where: { ...scope, id: { in: input.certificateIds } },
        select: { id: true, roundId: true },
      }),
      tx.equityConvertible.findMany({
        where: { ...scope, id: { in: input.convertibleIds } },
        select: { id: true, roundId: true },
      }),
    ]);
    if (
      certificates.length !== new Set(input.certificateIds).size ||
      convertibles.length !== new Set(input.convertibleIds).size
    )
      throw new EquityInputError("Unknown security");
    const effectiveDate = today();
    for (const row of certificates) {
      await tx.equityCertificate.update({
        where: { id: row.id },
        data: { roundId: input.roundId },
      });
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate,
        certificateId: row.id,
        before: { roundId: row.roundId },
        after: { roundId: input.roundId },
      });
    }
    for (const row of convertibles) {
      await tx.equityConvertible.update({
        where: { id: row.id },
        data: { roundId: input.roundId },
      });
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate,
        convertibleId: row.id,
        before: { roundId: row.roundId },
        after: { roundId: input.roundId },
      });
    }
    return { certificates: certificates.length, convertibles: convertibles.length };
  });
}
