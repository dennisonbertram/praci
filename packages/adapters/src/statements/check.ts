import type { ParsedStatement, StatementCheck } from "@rakazo/contracts";

/**
 * opening + sum(amounts) === closing, in integer cents. Also walks the printed running balances
 * and, at the first line that breaks, adds a warning to `statement.warnings`.
 */
export function checkStatement(statement: ParsedStatement): StatementCheck {
  const broken = runningBalanceWarning(statement);
  if (broken && !statement.warnings.includes(broken)) statement.warnings.push(broken);
  const { openingBalanceCents: opening, closingBalanceCents: closing } = statement;
  if (opening === null || closing === null)
    return { balances: "unavailable", differenceCents: null };
  const sum = statement.transactions.reduce((total, t) => total + BigInt(t.amountCents), 0n);
  const difference = Number(BigInt(closing) - (BigInt(opening) + sum));
  return { balances: difference === 0 ? "match" : "mismatch", differenceCents: difference };
}

/** Names the first line whose printed running balance does not follow from the one before. */
function runningBalanceWarning(statement: ParsedStatement): string | null {
  let balance = statement.openingBalanceCents;
  for (const [i, txn] of statement.transactions.entries()) {
    if (
      txn.balanceCents !== null &&
      balance !== null &&
      balance + txn.amountCents !== txn.balanceCents
    ) {
      return `Running balance breaks at line ${i + 1} (${txn.date}).`;
    }
    balance = txn.balanceCents ?? (balance === null ? null : balance + txn.amountCents);
  }
  return null;
}
