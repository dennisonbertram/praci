import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceStatement } from "@rakazo/contracts";
import { Badge, Button } from "@rakazo/ui-web";
import { fullDay, moneyExact } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";

/** The parser marks a model-read PDF with this opening; it is the one warning shown in bold. */
const MODEL_READ = "Read by an AI model";

export type StatementRow = {
  key: number;
  statement: FinanceStatement;
  busy: boolean;
  error?: string;
};

/** The account a statement belongs to; statements without a name or number stand alone. */
export function statementAccountKey(row: StatementRow): string {
  const { institution, accountLast4 } = row.statement;
  return institution || accountLast4
    ? `${institution ?? ""}|${accountLast4 ?? ""}`
    : `file:${row.key}`;
}

/**
 * The balance check line. The parser checks opening + transactions = closing, and reports the
 * closing balance minus what the transactions add up to.
 */
function CheckLine({ statement }: { statement: FinanceStatement }) {
  useHideAmounts();
  const { t } = useLingui();
  const { check } = statement;
  if (check?.balances === "match") {
    return (
      <div className="text-success">
        <Trans>Transactions add up to the closing balance</Trans>
      </div>
    );
  }
  if (check?.balances === "mismatch" && check.differenceCents != null) {
    return (
      <div role="alert" className="text-destructive">
        {t`Transactions are ${moneyExact(Math.abs(check.differenceCents))} off the closing balance`}
      </div>
    );
  }
  return null;
}

function Row({ row, onRemove }: { row: StatementRow; onRemove: () => void }) {
  useHideAmounts();
  const { t } = useLingui();
  const { statement } = row;
  const money = (cents: number | null) => (cents === null ? "—" : moneyExact(cents));
  return (
    <li className="flex flex-col gap-1 border-t border-border py-2 text-sm first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {statement.periodStart && statement.periodEnd
            ? `${fullDay(statement.periodStart)} – ${fullDay(statement.periodEnd)}`
            : statement.fileName}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-success">
            <Trans>Imported</Trans>
          </span>
          <Button type="button" variant="ghost" size="xs" disabled={row.busy} onClick={onRemove}>
            <Trans>Remove</Trans>
          </Button>
        </span>
      </div>
      <div className="tabular-nums text-muted-foreground">
        {money(statement.openingBalanceCents)} → {money(statement.closingBalanceCents)}
        {" · "}
        {t`${statement.transactionCount} transactions`}
        {statement.duplicateCount > 0 ? t`, ${statement.duplicateCount} already imported` : ""}
      </div>
      <CheckLine statement={statement} />
      {statement.warnings.map((warning) => (
        <div
          key={warning}
          className={
            warning.startsWith(MODEL_READ) ? "font-medium text-warning" : "text-muted-foreground"
          }
        >
          {warning}
        </div>
      ))}
      {row.error ? (
        <p role="alert" className="text-destructive">
          {row.error}
        </p>
      ) : null}
    </li>
  );
}

/** Imported statements of one account: one header, then a compact row per statement period. */
export function StatementGroup({
  rows,
  onRemove,
}: {
  rows: StatementRow[];
  onRemove: (row: StatementRow) => void;
}) {
  const first = rows[0]?.statement;
  if (!first) return null;
  const name = [first.institution, first.accountLast4 ? `••${first.accountLast4}` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <li className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{name || first.fileName}</span>
        {rows.some((r) => r.statement.createsAccount) ? (
          <Badge variant="outline">
            <Trans>New account</Trans>
          </Badge>
        ) : null}
      </div>
      <ul>
        {rows.map((row) => (
          <Row key={row.key} row={row} onRemove={() => onRemove(row)} />
        ))}
      </ul>
    </li>
  );
}
