import { Trans, useLingui } from "@lingui/react/macro";
import type { BrexExpenses as BrexExpensesData, BrexExpenseView } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { moneyInList, shortDay } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Section, useFinanceQuery } from "../finance/ui";
import { PickFilter, SortControl } from "../ListControls";
import { BrexSection } from "./BrexSection";
import { BrexWritesOffHint } from "./BrexWritesOffHint";

// Where the owner approves a reimbursement or sees the expense in Brex; the API has no approval call.
const BREX_EXPENSES_URL = "https://dashboard.brex.com/expenses";

// Brex ids are plain tokens. The id is Brex-controlled text, so anything else is never sent.
const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const MEMO_MAX = 2000;

const dash = "—";

type ExpenseSort = "date" | "merchant" | "person" | "amount";
const EXPENSE_SORTS: readonly ExpenseSort[] = ["date", "merchant", "person", "amount"];

function expenseDay(expense: BrexExpenseView): string {
  return expense.day ?? expense.purchasedAt?.slice(0, 10) ?? "";
}

function missingChips(expense: BrexExpenseView) {
  return (
    <span className="flex flex-wrap gap-1">
      {expense.missingReceipt ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <Trans>Receipt</Trans>
        </span>
      ) : null}
      {expense.missingMemo ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <Trans>Memo</Trans>
        </span>
      ) : null}
    </span>
  );
}

function amountText(expense: BrexExpenseView): string {
  return expense.amountCents === null
    ? dash
    : moneyInList(expense.amountCents, undefined, expense.currency ?? undefined);
}

/** Edit memo sends one fixed message: the expense id and the memo as data. The memo's text never steers the template. */
function MemoDialog({
  busy,
  error,
  onSend,
  onClose,
}: {
  busy: boolean;
  error: string;
  onSend: (memo: string) => void;
  onClose: () => void;
}) {
  const [memo, setMemo] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = memo.trim();
    if (trimmed) onSend(trimmed);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              <Trans>Edit memo</Trans>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-expense-memo">
              <Trans>Memo</Trans>
            </Label>
            <Input
              id="brex-expense-memo"
              autoFocus
              maxLength={MEMO_MAX}
              autoComplete="off"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || !memo.trim()}>
              <Trans>Send</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesView({ data }: { data: BrexExpensesData }) {
  useHideAmounts();
  const { t } = useLingui();
  const navigate = useNavigate();
  const list = useListParams(EXPENSE_SORTS, { field: "date", dir: "desc" });
  const [pending, setPending] = useState<BrexExpenseView | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const enabled = Boolean(data.writesEnabled && data.agentBotId);
  useEffect(() => {
    if (!enabled) setPending(null);
  }, [enabled]);

  const missing = list.param("missing");
  const attention = data.expenses.filter(
    (expense) => expense.missingReceipt || expense.missingMemo,
  );
  const filtered = attention.filter((expense) => {
    if (missing === "receipt") return expense.missingReceipt;
    if (missing === "memo") return expense.missingMemo;
    return true;
  });
  const picks: Record<ExpenseSort, (expense: BrexExpenseView) => string | number | null> = {
    date: (expense) => expenseDay(expense) || null,
    merchant: (expense) => expense.merchant,
    person: (expense) => expense.userName ?? expense.userId,
    amount: (expense) => expense.amountCents,
  };
  const rows = sortBy(filtered, picks[list.sort.field], list.sort.dir);
  const waiting = sortBy(
    data.reimbursements.filter((expense) => expense.status === "SUBMITTED"),
    (expense) => expenseDay(expense) || null,
    "desc",
  );

  const sortHead = (field: ExpenseSort) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const sortNames: Record<ExpenseSort, string> = {
    date: t`Date`,
    merchant: t`Merchant`,
    person: t`Person`,
    amount: t`Amount`,
  };

  async function sendMemo(memo: string) {
    if (!pending || !data.agentBotId || !enabled || busy) return;
    setBusy(true);
    setSendError("");
    try {
      await rpc.threads.send({
        botId: data.agentBotId,
        clientNonce: newClientId(),
        text: `Set the memo of expense ${pending.expenseId} to ${memo}.`,
      });
      setPending(null);
      navigate(`/app/${data.agentBotId}`);
    } catch (cause) {
      setSendError(errorText(cause));
      setBusy(false);
    }
  }

  const filteredList = Boolean(missing);
  return (
    <div className="flex flex-col gap-3">
      {data.partial ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Partial results</Trans>
        </p>
      ) : null}
      <Section
        title={
          <>
            <Trans>Needs a receipt or memo</Trans>{" "}
            <span className="font-normal">
              {attention.length} {attention.length === 1 ? t`expense` : t`expenses`}
            </span>
          </>
        }
      >
        {attention.length > 0 && (
          <div data-list-toolbar className="mb-2 mt-2 flex flex-wrap items-center gap-2">
            <PickFilter
              label={t`Missing`}
              value={missing}
              options={[
                ["receipt", t`Receipt`],
                ["memo", t`Memo`],
              ]}
              onChange={(value) => list.setParam("missing", value)}
            />
            <span className="ms-auto flex items-center gap-1 @6xl:hidden">
              <SortControl
                fields={EXPENSE_SORTS.map((field) => [field, sortNames[field]])}
                field={list.sort.field}
                fieldLabel={sortNames[list.sort.field]}
                direction={list.sort.dir}
                onField={(field) => list.setSort({ field: field as ExpenseSort, dir: "asc" })}
                onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
              />
            </span>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {filteredList ? (
              <Trans>No matches</Trans>
            ) : (
              <Trans>No expenses need a receipt or memo.</Trans>
            )}
          </p>
        ) : (
          <Table compact>
            <caption className="sr-only">
              <Trans>Expenses needing a receipt or memo</Trans>
            </caption>
            <TableHeader>
              <TableHeadRow>
                <TableHead {...sortHead("date")} className="hidden @lg:table-cell">
                  <Trans>Date</Trans>
                </TableHead>
                <TableHead {...sortHead("merchant")}>
                  <Trans>Merchant</Trans>
                </TableHead>
                <TableHead {...sortHead("person")} className="hidden @lg:table-cell">
                  <Trans>Person</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Missing</Trans>
                </TableHead>
                <TableHead {...sortHead("amount")} className="text-end">
                  <Trans>Amount</Trans>
                </TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">
                    <Trans>Actions</Trans>
                  </span>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {rows.map((expense) => (
                <TableRow key={expense.expenseId}>
                  <TableCell className="hidden whitespace-nowrap @lg:table-cell">
                    {shortDay(expenseDay(expense)) || dash}
                  </TableCell>
                  <TableCell className="max-w-52 truncate" title={expense.merchant ?? ""}>
                    {expense.merchant ?? dash}
                  </TableCell>
                  <TableCell className="hidden max-w-40 truncate @lg:table-cell">
                    {expense.userName ?? expense.userId ?? dash}
                  </TableCell>
                  <TableCell>{missingChips(expense)}</TableCell>
                  <TableCell className="whitespace-nowrap text-end tabular-nums">
                    {amountText(expense)}
                  </TableCell>
                  <TableCell className="text-end">
                    {expense.missingMemo ? (
                      <BrexWritesOffHint writesOff={!enabled && SAFE_ID.test(expense.expenseId)}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!enabled || !SAFE_ID.test(expense.expenseId)}
                          onClick={() => {
                            setSendError("");
                            setPending(expense);
                          }}
                        >
                          <Trans>Edit memo</Trans>
                        </Button>
                      </BrexWritesOffHint>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section
        title={<Trans>Reimbursements waiting</Trans>}
        action={
          <>
            <span className="text-xs text-muted-foreground">
              <Trans>Read only</Trans>
            </span>
            <Button
              variant="link"
              size="sm"
              render={<a href={BREX_EXPENSES_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <Trans>Approve in Brex</Trans>
            </Button>
          </>
        }
      >
        {waiting.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            <Trans>No reimbursements waiting.</Trans>
          </p>
        ) : (
          <Table compact>
            <caption className="sr-only">
              <Trans>Reimbursements waiting for approval</Trans>
            </caption>
            <TableHeader>
              <TableHeadRow>
                <TableHead>
                  <Trans>Person</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Description</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Submitted</Trans>
                </TableHead>
                <TableHead className="text-end">
                  <Trans>Amount</Trans>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {waiting.map((expense) => (
                <TableRow key={expense.expenseId}>
                  <TableCell className="max-w-40 truncate">
                    {expense.userName ?? expense.userId ?? dash}
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate"
                    title={expense.memo ?? expense.merchant ?? ""}
                  >
                    {expense.memo ?? expense.merchant ?? dash}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {shortDay(expenseDay(expense)) || dash}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-end tabular-nums">
                    {amountText(expense)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      {pending ? (
        <MemoDialog
          busy={busy}
          error={sendError}
          onSend={(memo) => void sendMemo(memo)}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

/** The owner's expenses: what is missing a receipt or memo, and reimbursements waiting (read only). */
export function BrexExpenses() {
  const query = useFinanceQuery(() => rpc.brexCards.expenses(), []);
  return <BrexSection query={query}>{(data) => <ExpensesView data={data} />}</BrexSection>;
}
