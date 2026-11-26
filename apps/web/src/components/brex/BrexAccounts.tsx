import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  BrexAccount,
  BrexAccounts as BrexAccountsData,
  BrexStatement,
} from "@rakazo/contracts";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { dayRange, money, shortDay } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { Section, useFinanceQuery } from "../finance/ui";
import { BrexSection } from "./BrexSection";

// Statements have no file in the API: the owner opens or downloads them in Brex.
const BREX_STATEMENTS_URL = "https://dashboard.brex.com/statements-and-documents";

const dash = "—";

function accountStatus(status: string | null): string {
  if (!status) return dash;
  if (status === "ACTIVE") return t`Active`;
  if (status === "CLOSED") return t`Closed`;
  return status;
}

function balance(cents: number | null, currency?: string): string {
  return cents === null ? dash : money(cents, undefined, currency);
}

function statementPeriod(statement: BrexStatement): string {
  if (statement.startDate && statement.endDate) {
    return dayRange(statement.startDate, statement.endDate) || dash;
  }
  const day = statement.endDate ?? statement.startDate;
  return day ? shortDay(day) || dash : dash;
}

function statementAccount(statement: BrexStatement): string {
  if (statement.accountKind === "card") return t`Card account`;
  return statement.accountName ?? dash;
}

type AccountSort = "name" | "status" | "current" | "available";
type StatementSort = "period" | "account" | "start" | "end";

function AccountsView({ data }: { data: BrexAccountsData }) {
  useHideAmounts();
  const accounts = useListParams(["name", "status", "current", "available"] as const, {
    field: "name",
    dir: "asc",
  });
  // Two sortable lists on one page: the statements one prefixes its URL params.
  const statements = useListParams(
    ["period", "account", "start", "end"] as const,
    { field: "period", dir: "desc" },
    "stmt-",
  );

  // Statements carry no currency in the contract; a cash statement takes its account's.
  const currencyById = new Map(
    data.accounts.map((account) => [account.cashAccountId, account.currency]),
  );
  const statementCurrency = (statement: BrexStatement): string | undefined =>
    statement.cashAccountId ? (currencyById.get(statement.cashAccountId) ?? undefined) : undefined;

  const accountPicks: Record<AccountSort, (account: BrexAccount) => string | number | null> = {
    name: (account) => account.name ?? account.cashAccountId,
    status: (account) => account.status,
    current: (account) => account.currentBalanceCents,
    available: (account) => account.availableBalanceCents,
  };
  const statementPicks: Record<
    StatementSort,
    (statement: BrexStatement) => string | number | null
  > = {
    period: (statement) => statement.endDate ?? statement.startDate,
    account: (statement) =>
      statement.accountKind === "card" ? "Card account" : statement.accountName,
    start: (statement) => statement.startBalanceCents,
    end: (statement) => statement.endBalanceCents,
  };
  const accountRows = sortBy(
    data.accounts,
    accountPicks[accounts.sort.field as AccountSort],
    accounts.sort.dir,
  );
  const statementRows = sortBy(
    data.statements,
    statementPicks[statements.sort.field as StatementSort],
    statements.sort.dir,
  );
  const accountHead = (field: AccountSort) => ({
    sortDirection: accounts.sort.field === field ? accounts.sort.dir : null,
    onSort: () => accounts.toggleSort(field),
  });
  const statementHead = (field: StatementSort) => ({
    sortDirection: statements.sort.field === field ? statements.sort.dir : null,
    onSort: () => statements.toggleSort(field),
  });

  return (
    <div className="flex flex-col gap-3">
      <Section title={<Trans>Cash accounts</Trans>}>
        {accountRows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            <Trans>No cash accounts.</Trans>
          </p>
        ) : (
          <Table compact>
            <caption className="sr-only">
              <Trans>Cash accounts</Trans>
            </caption>
            <TableHeader>
              <TableHeadRow>
                <TableHead {...accountHead("name")}>
                  <Trans>Account</Trans>
                </TableHead>
                <TableHead {...accountHead("status")}>
                  <Trans>Status</Trans>
                </TableHead>
                <TableHead {...accountHead("current")} className="text-end">
                  <Trans>Current</Trans>
                </TableHead>
                <TableHead {...accountHead("available")} className="text-end">
                  <Trans>Available</Trans>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {accountRows.map((account) => (
                <TableRow key={account.cashAccountId}>
                  <TableCell className="max-w-56 truncate">
                    {account.name ?? account.cashAccountId}
                    {account.primary ? (
                      <span className="ms-1.5 text-xs text-muted-foreground">
                        <Trans>Primary</Trans>
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {accountStatus(account.status)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-end tabular-nums">
                    {balance(account.currentBalanceCents, account.currency ?? undefined)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-end tabular-nums">
                    {balance(account.availableBalanceCents, account.currency ?? undefined)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section
        title={<Trans>Statements</Trans>}
        action={
          <Button
            variant="link"
            size="sm"
            render={<a href={BREX_STATEMENTS_URL} target="_blank" rel="noopener noreferrer" />}
          >
            <Trans>Download in Brex</Trans>
          </Button>
        }
      >
        {statementRows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            <Trans>No statements yet.</Trans>
          </p>
        ) : (
          <Table compact>
            <caption className="sr-only">
              <Trans>Brex statements</Trans>
            </caption>
            <TableHeader>
              <TableHeadRow>
                <TableHead {...statementHead("account")}>
                  <Trans>Account</Trans>
                </TableHead>
                <TableHead {...statementHead("period")}>
                  <Trans>Period</Trans>
                </TableHead>
                <TableHead {...statementHead("start")} className="text-end">
                  <Trans>Start balance</Trans>
                </TableHead>
                <TableHead {...statementHead("end")} className="text-end">
                  <Trans>End balance</Trans>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {statementRows.map((statement) => (
                <TableRow key={statement.statementId}>
                  <TableCell className="max-w-48 truncate">{statementAccount(statement)}</TableCell>
                  <TableCell className="whitespace-nowrap">{statementPeriod(statement)}</TableCell>
                  <TableCell className="whitespace-nowrap text-end tabular-nums">
                    {balance(statement.startBalanceCents, statementCurrency(statement))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-end tabular-nums">
                    {balance(statement.endBalanceCents, statementCurrency(statement))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

/** The owner's cash accounts and statements; statements open in Brex, there is no file in the API. */
export function BrexAccounts() {
  const query = useFinanceQuery(() => rpc.brexCards.accounts(), []);
  return <BrexSection query={query}>{(data) => <AccountsView data={data} />}</BrexSection>;
}
