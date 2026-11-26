// Money raised: one rule for the overview, the cap table, the rounds and the cash raised view.
// Raised is the consideration carried by the certificates outstanding on the date (cash, debt
// canceled, IP transferred, other) plus the principal of convertibles that were not canceled by
// then. Transfers, splits and class conversions hand their share of the consideration to the new
// certificates, so the total survives them. A certificate made by converting a SAFE or note is not
// new money: the convertible's principal is counted instead. Callers pass only the certificates
// outstanding on the date (see isOutstandingOn in cap-table.ts).

export type RaisedCertificate = {
  shareClassId: string;
  roundId?: string | null;
  cashPaidCents: bigint;
  debtCanceledCents?: bigint;
  ipTransferredCents?: bigint;
  otherConsiderationCents?: bigint;
  fromConvertible?: boolean;
};

export type RaisedConvertible = {
  roundId?: string | null;
  principalCents: bigint;
};

/** True when the certificate's consideration is new money (not a SAFE or note converting). */
export function isNewMoneyCertificate(certificate: RaisedCertificate): boolean {
  return !certificate.fromConvertible;
}

/**
 * True when the convertible's principal counts as raised on the date: issued by then and not
 * canceled before it. Converted and repaid convertibles still count.
 */
export function isRaisedConvertibleOn(
  convertible: { status: string; issueDate: string; closedOn?: string | null },
  asOf: string,
): boolean {
  return (
    convertible.issueDate <= asOf &&
    (convertible.status !== "canceled" ||
      (convertible.closedOn != null && convertible.closedOn > asOf))
  );
}

/** Everything paid for a certificate: cash, debt canceled, IP transferred and other. */
export function considerationCents(certificate: RaisedCertificate): bigint {
  return (
    certificate.cashPaidCents +
    (certificate.debtCanceledCents ?? 0n) +
    (certificate.ipTransferredCents ?? 0n) +
    (certificate.otherConsiderationCents ?? 0n)
  );
}

export type RaisedTotals = {
  totalCents: bigint;
  convertiblesCents: bigint;
  byClass: Map<string, bigint>;
  byRound: Map<string, bigint>;
};

export function raisedCents(
  certificates: readonly RaisedCertificate[],
  convertibles: readonly RaisedConvertible[],
): RaisedTotals {
  const byClass = new Map<string, bigint>();
  const byRound = new Map<string, bigint>();
  let total = 0n;
  let convertiblesCents = 0n;
  const addRound = (roundId: string | null | undefined, cents: bigint) => {
    if (roundId) byRound.set(roundId, (byRound.get(roundId) ?? 0n) + cents);
  };
  for (const certificate of certificates) {
    if (!isNewMoneyCertificate(certificate)) continue;
    const cents = considerationCents(certificate);
    total += cents;
    byClass.set(certificate.shareClassId, (byClass.get(certificate.shareClassId) ?? 0n) + cents);
    addRound(certificate.roundId, cents);
  }
  for (const convertible of convertibles) {
    total += convertible.principalCents;
    convertiblesCents += convertible.principalCents;
    addRound(convertible.roundId, convertible.principalCents);
  }
  return { totalCents: total, convertiblesCents, byClass, byRound };
}
