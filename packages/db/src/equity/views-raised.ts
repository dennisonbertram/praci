import type { RaisedTotals } from "@rakazo/core/equity";
import { isOutstandingOn, isRaisedConvertibleOn, raisedCents } from "@rakazo/core/equity";
import type { EquityDb, EquityScope } from "./ledger.js";
import { fromDate, fromDateOrNull, scopeOf, toDate } from "./ledger.js";

/** The kinds of transaction that close a certificate (the source of a transfer, repurchase...). */
const CLOSING_KINDS = ["transfer", "repurchase", "cancel", "convert"];

export type CertificateHistory = { closedOn: string | null; fromConvertible: boolean };

/**
 * What the dated history says about each certificate: the day it stopped being outstanding (the
 * earliest of its `canceledOn`, a closing transaction, or the issue of a child certificate) and
 * whether it descends from a converted SAFE or note, whose principal is counted instead of its
 * consideration. A certificate with no entry has neither.
 */
export async function loadCertificateHistory(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<Map<string, CertificateHistory>> {
  const scope = scopeOf(actor);
  const [rows, closings, converted] = await Promise.all([
    prisma.equityCertificate.findMany({
      where: scope,
      select: { id: true, parentId: true, issueDate: true, canceledOn: true },
    }),
    prisma.equityTransaction.findMany({
      where: { ...scope, kind: { in: CLOSING_KINDS }, certificateId: { not: null } },
      select: { certificateId: true, effectiveDate: true },
    }),
    prisma.equityConvertible.findMany({
      where: { ...scope, convertedToId: { not: null } },
      select: { convertedToId: true },
    }),
  ]);
  const closedOn = new Map<string, string>();
  const close = (id: string | null, date: string | null) => {
    if (id && date && (!closedOn.has(id) || date < (closedOn.get(id) as string)))
      closedOn.set(id, date);
  };
  for (const row of rows) {
    close(row.id, fromDateOrNull(row.canceledOn));
    close(row.parentId, fromDate(row.issueDate));
  }
  for (const closing of closings) close(closing.certificateId, fromDate(closing.effectiveDate));
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
  const roots = new Set(converted.map((row) => row.convertedToId));
  const fromConvertible = (id: string | null): boolean => {
    for (let hops = 0; id && hops < 1000; hops++, id = parentOf.get(id) ?? null)
      if (roots.has(id)) return true;
    return false;
  };
  return new Map(
    rows.map((row) => [
      row.id,
      { closedOn: closedOn.get(row.id) ?? null, fromConvertible: fromConvertible(row.id) },
    ]),
  );
}

/**
 * Money raised in the caller's ledger, by the one rule in core `raisedCents`: the overview, the
 * cap table, the rounds and the cash raised view all read it from here so their totals agree.
 */
export async function loadEquityRaised(
  prisma: EquityDb,
  actor: EquityScope,
  options: { asOf?: string; roundIds?: string[] } = {},
): Promise<RaisedTotals> {
  const scope = scopeOf(actor);
  // Without a date every certificate counts by its current status.
  const asOf = options.asOf ?? "9999-12-31";
  const where = {
    ...scope,
    issueDate: { lte: toDate(asOf) },
    ...(options.roundIds ? { roundId: { in: options.roundIds } } : {}),
  };
  const [certificates, convertibles, history] = await Promise.all([
    prisma.equityCertificate.findMany({ where }),
    prisma.equityConvertible.findMany({ where }),
    loadCertificateHistory(prisma, scope),
  ]);
  return raisedCents(
    newMoneyCertificates(certificates, history, asOf),
    raisedConvertibles(convertibles, asOf),
  );
}

/** The certificates outstanding on the date that are not the result of converting a SAFE or note. */
export function newMoneyCertificates<T extends { id: string; status: string; issueDate: Date }>(
  rows: readonly T[],
  history: ReadonlyMap<string, CertificateHistory>,
  asOf: string,
): T[] {
  return rows.filter((row) => {
    const entry = history.get(row.id);
    return (
      !entry?.fromConvertible &&
      isOutstandingOn(
        { status: row.status, issueDate: fromDate(row.issueDate), closedOn: entry?.closedOn },
        asOf,
      )
    );
  });
}

/** The convertibles whose principal counts as raised on the date. */
export function raisedConvertibles<
  T extends { status: string; issueDate: Date; closedOn: Date | null },
>(rows: readonly T[], asOf: string): T[] {
  return rows.filter((row) =>
    isRaisedConvertibleOn(
      {
        status: row.status,
        issueDate: fromDate(row.issueDate),
        closedOn: fromDateOrNull(row.closedOn),
      },
      asOf,
    ),
  );
}

/** A certificate row's dated fields for the core rules: string issue date and its history. */
export function withHistory(
  row: { id: string; issueDate: Date },
  history: ReadonlyMap<string, CertificateHistory>,
) {
  const entry = history.get(row.id);
  return {
    issueDate: fromDate(row.issueDate),
    closedOn: entry?.closedOn ?? null,
    fromConvertible: entry?.fromConvertible ?? false,
  };
}
