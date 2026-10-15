import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceStatement } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { fullDay, moneyExact } from "../../lib/finance-format";

/** The parser marks a model-read PDF with this opening; it is the one warning shown in bold. */
const MODEL_READ = "Read by an AI model";

/** One uploaded statement before it is imported: what it is, what it will do, and the balance check. */
export function StatementReviewCard({
  statement,
  busy,
  onImport,
  onDiscard,
}: {
  statement: FinanceStatement;
  busy: boolean;
  onImport: () => void;
  onDiscard: () => void;
}) {
  const { t } = useLingui();
  const { check } = statement;
  const mismatch = check?.balances === "mismatch";
  const name = [
    statement.institution,
    statement.accountLast4 ? `••${statement.accountLast4}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const money = (cents: number | null) => (cents === null ? "—" : moneyExact(cents));
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{name || statement.fileName}</span>
        {statement.createsAccount ? (
          <span className="rounded-full border border-border px-1.5 text-[10px] text-muted-foreground">
            <Trans>New account</Trans>
          </span>
        ) : null}
      </div>
      {statement.periodStart && statement.periodEnd ? (
        <div className="text-muted-foreground">
          {fullDay(statement.periodStart)} – {fullDay(statement.periodEnd)}
        </div>
      ) : null}
      <div className="tabular-nums">
        {money(statement.openingBalanceCents)} → {money(statement.closingBalanceCents)}
      </div>
      <div className="text-muted-foreground">
        {t`${statement.transactionCount} transactions`}
        {statement.duplicateCount > 0 ? t`, ${statement.duplicateCount} already imported` : ""}
      </div>
      {check?.balances === "match" ? (
        <div className="text-success">
          <Trans>Balances match</Trans>
        </div>
      ) : null}
      {mismatch && check?.differenceCents != null ? (
        <div role="alert" className="text-destructive">
          {t`Balances differ by ${moneyExact(Math.abs(check.differenceCents))}`}
        </div>
      ) : null}
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
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onDiscard}>
          <Trans>Discard</Trans>
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={onImport}>
          {mismatch ? <Trans>Import anyway</Trans> : <Trans>Import</Trans>}
        </Button>
      </div>
    </li>
  );
}
