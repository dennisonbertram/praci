import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalContract, LegalContractStatus } from "@rakazo/contracts";
import {
  Button,
  ContactAvatarGroup,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PickFilter, SearchField, SortControl } from "../../components/ListControls";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay, hiddenOr } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { contractValue, daysBetween, todayIso } from "../../lib/legal-format";
import { useListParams } from "../../lib/list-params";
import type { ContractSort } from "./contract-list";
import {
  CONTRACT_SORTS,
  CONTRACT_STATUSES,
  contractRows,
  contractStatus,
  DEFAULT_CONTRACT_SORT,
  OPTIONAL_STATUSES,
} from "./contract-list";

const statusName = (status: LegalContractStatus): string =>
  ({
    active: t`Active`,
    expired: t`Expired`,
    terminated: t`Terminated`,
    draft: t`Draft`,
    unknown: t`Unknown`,
  })[status];

const dash = "—";

function renewal(contract: LegalContract): string {
  const notice = contract.renewalNoticeDays;
  if (contract.autoRenews === null) return dash;
  if (!contract.autoRenews) return t`No auto-renewal`;
  return notice === null ? t`Auto-renews` : t`Auto-renews, ${notice} days notice`;
}

function term(contract: LegalContract): string {
  const from = contract.effectiveDate ? fullDay(contract.effectiveDate) : "";
  const to = contract.expirationDate ? fullDay(contract.expirationDate) : "";
  if (from && to) return `${from} – ${to}`;
  if (from) return t`Since ${from}`;
  if (to) return t`Until ${to}`;
  return dash;
}

const value = (contract: LegalContract) =>
  contract.valueCents === null
    ? dash
    : hiddenOr(contractValue(contract.valueCents, contract.currency));

/** A deadline already past is red, matching the Overdue tile above the table. */
function NextDeadline({ contract }: { contract: LegalContract }) {
  if (!contract.nextDeadline) return dash;
  const late = daysBetween(todayIso(), contract.nextDeadline) < 0;
  return (
    <span className={cn(late && "font-medium text-destructive")}>
      {fullDay(contract.nextDeadline)}
    </span>
  );
}

function Title({ contract, wrap = false }: { contract: LegalContract; wrap?: boolean }) {
  return (
    <Link
      to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
      state={{ from: "legal" }}
      className="rk-tap min-w-0 font-medium hover:underline"
    >
      {/* .rk-tap is inline-flex on phones and the link is inline elsewhere, so neither can clip: the text truncates as a block inside it. */}
      <span className={cn("block min-w-0", wrap ? "line-clamp-2" : "truncate")}>
        {contract.title}
      </span>
    </Link>
  );
}

/** A company name without case, punctuation, a trailing "(Mock)" note or a trailing legal suffix such as "Inc.". */
const companyKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s*\(mock\)\s*$/, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ (inc|llc|ltd|corp|corporation|co|company|gmbh)$/, "");

export function withoutSelf(contract: LegalContract, selfName?: string): LegalContract {
  const self = selfName ? companyKey(selfName) : "";
  const others = contract.counterparties.filter((party) => companyKey(party) !== self);
  return self && others.length > 0 ? { ...contract, counterparties: others } : contract;
}

/** Active is the normal case and says nothing; only a contract that is not active gets a chip. */
function Status({ status }: { status: LegalContractStatus }) {
  if (status === "active") return null;
  return (
    <span className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-2 text-xs leading-none">
      {statusName(status)}
    </span>
  );
}

const parties = (names: string[]) => names.map((name) => ({ name }));

/** The "+N more" button of a collapsed or expanded group. */
function MoreButton({
  count,
  open,
  onClick,
}: {
  count: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="rk-tap inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <Trans>+{count} more</Trans>
      <ChevronRight size={12} className={cn("transition-transform", open && "rotate-90")} />
    </button>
  );
}

/** What a group row shows in place of one contract's cells: the shared parts, else a dash. */
function groupSummary(members: LegalContract[]) {
  const first = members[0] as LegalContract;
  const same = <T,>(pick: (c: LegalContract) => T) => members.every((c) => pick(c) === pick(first));
  const deadlines = members.flatMap((c) => (c.nextDeadline ? [c.nextDeadline] : [])).sort();
  return {
    parties: [...new Set(members.flatMap((c) => c.counterparties))],
    // The group key makes the term dates equal; renewal may still differ.
    renewal: same(renewal) ? renewal(first) : dash,
    term: term(first),
    nextDeadline: deadlines[0] ?? null,
    first,
  };
}

/**
 * Every contract the Legal agent found, with a link to its document in the Data room. Wide, a
 * table with fixed column widths (so hiding amounts does not move the columns); narrow, one card
 * per contract, so nothing is cut off at the side. With `grouped`, three or more near-identical
 * contracts (see groupLegalContracts) share one row that opens to its members.
 */
export function LegalContracts({
  contracts: all,
  selfName,
  grouped = false,
  actions,
}: {
  contracts: LegalContract[];
  /** The company itself: every contract is with it, so it is left out of Parties. */
  selfName?: string;
  grouped?: boolean;
  /** Extra controls at the end of the toolbar (the page's Group similar button). */
  actions?: ReactNode;
}) {
  const contracts = all.map((contract) => withoutSelf(contract, selfName));
  // Search, filters and sort live in the URL: ?q=, type, party, status, sort, dir.
  const list = useListParams(CONTRACT_SORTS, DEFAULT_CONTRACT_SORT);
  const filters = {
    q: list.param("q"),
    type: list.param("type"),
    party: list.param("party"),
    status: list.param("status"),
  };
  const filtered = Object.values(filters).some(Boolean);
  const rows = contractRows(contracts, filters, list.sort, grouped, todayIso());
  const unique = (values: string[]): [string, string][] =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b)).map((v) => [v, v]);
  const statusNames: Record<string, string> = {
    ...Object.fromEntries(
      (["active", "expired", "terminated", "draft", "unknown"] as const).map((s) => [
        s,
        statusName(s),
      ]),
    ),
    expiring: t`Expiring soon`,
  };
  // Terminated, Draft and Unknown are offered only when some contract has them or one is selected.
  const statusOptions = [
    ...CONTRACT_STATUSES,
    ...OPTIONAL_STATUSES.filter(
      (s) => s === filters.status || contracts.some((c) => c.status === s),
    ),
  ];
  const sortNames: Record<ContractSort, string> = {
    name: t`Contract`,
    term: t`Term`,
    value: t`Value`,
    deadline: t`Next deadline`,
  };
  const sortHead = (field: ContractSort) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <SearchField
        name="contracts-search"
        value={filters.q ?? ""}
        onChange={(value) => list.setParam("q", value)}
        placeholder={t`Search contracts`}
        label={t`Search contracts`}
        className="w-56"
      />
      <PickFilter
        label={t`Type`}
        value={filters.type}
        options={unique(contracts.map((c) => c.contractType))}
        onChange={(value) => list.setParam("type", value)}
      />
      <PickFilter
        label={t`Party`}
        value={filters.party}
        options={unique(contracts.flatMap((c) => c.counterparties))}
        onChange={(value) => list.setParam("party", value)}
      />
      <PickFilter
        label={t`Status`}
        value={filters.status}
        options={statusOptions.map((status) => [status, statusNames[status] ?? status])}
        onChange={(value) => list.setParam("status", value)}
      />
      <span className="ms-auto flex items-center gap-1">
        {/* Wide, the column headers sort; narrow, the cards have none. */}
        <span className="flex items-center gap-1 @6xl:hidden">
          <SortControl
            fields={CONTRACT_SORTS.map((field) => [field, sortNames[field]])}
            field={list.sort.field}
            fieldLabel={sortNames[list.sort.field]}
            direction={list.sort.dir}
            onField={(field) => list.setSort({ field, dir: "asc" })}
            onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
          />
        </span>
        {actions}
      </span>
    </div>
  );
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpenKeys((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const hidden = useHideAmounts();
  const navigate = useNavigate();
  // Any click on a row opens the contract; the title link stays the keyboard and screen-reader target.
  const open = (contract: LegalContract) => (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    navigate(`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`, { state: { from: "legal" } });
  };
  const card = (contract: LegalContract, nested = false) => {
    const names = contract.counterparties.join(", ");
    const showValue = !hidden && contract.valueCents !== null;
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: a mouse shortcut; the title link is the keyboard way in.
      <li
        key={contract.id}
        onClick={open(contract)}
        className={cn("cursor-pointer border-t border-border py-2 text-sm", nested && "ps-4")}
      >
        <div className="flex items-center justify-between gap-3">
          <Title contract={contract} wrap />
          <Status status={contractStatus(contract, todayIso())} />
        </div>
        {/* Only what the agent found: no labels, since the values say what they are. */}
        {names ? <p className="truncate text-xs text-muted-foreground">{names}</p> : null}
        <p className="text-xs text-muted-foreground">
          {[term(contract), renewal(contract), showValue ? `${t`Value`} ${value(contract)}` : dash]
            .filter((text) => text !== dash)
            .join(" · ")}
          {contract.nextDeadline ? (
            <>
              {" · "}
              <Trans>Due</Trans> <NextDeadline contract={contract} />
            </>
          ) : null}
        </p>
      </li>
    );
  };
  const tableRow = (contract: LegalContract, nested = false) => (
    <TableRow
      key={contract.id}
      onClick={open(contract)}
      className="cursor-pointer group-data-[compact]/table:h-10"
    >
      <TableCell title={`${contract.title} (${contract.contractType})`}>
        <div className={cn("flex max-w-72 items-center gap-2", nested && "ps-4")}>
          <Title contract={contract} />
          <Status status={contractStatus(contract, todayIso())} />
        </div>
      </TableCell>
      <TableCell>
        {contract.counterparties.length > 0 ? (
          <ContactAvatarGroup people={parties(contract.counterparties)} />
        ) : (
          dash
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums" title={term(contract)}>
        {term(contract)}
      </TableCell>
      <TableCell className="whitespace-nowrap" title={renewal(contract)}>
        {renewal(contract)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-end tabular-nums">{value(contract)}</TableCell>
      <TableCell className="whitespace-nowrap ps-4 tabular-nums">
        <NextDeadline contract={contract} />
      </TableCell>
    </TableRow>
  );
  if (rows.length === 0 && filtered) {
    return (
      <>
        {toolbar}
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            <Trans>No matches</Trans>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => list.clear("q", "type", "party", "status")}
          >
            <Trans>Clear filters</Trans>
          </Button>
        </div>
      </>
    );
  }
  return (
    <>
      {toolbar}
      <ul aria-label={t`Contracts`} className="flex flex-col @6xl:hidden">
        {rows.flatMap((row) => {
          if (row.kind === "single") return [card(row.contract)];
          const isOpen = openKeys.has(row.key);
          const sum = groupSummary(row.contracts);
          return [
            <li key={row.key} className="border-t border-border py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{row.name}</span>
                <MoreButton
                  count={row.contracts.length}
                  open={isOpen}
                  onClick={() => toggle(row.key)}
                />
              </div>
              <p className="truncate text-xs text-muted-foreground">{sum.parties.join(", ")}</p>
              <p className="text-xs text-muted-foreground">
                {[sum.term, sum.renewal].filter((text) => text !== dash).join(" · ")}
              </p>
            </li>,
            ...(isOpen ? row.contracts.map((contract) => card(contract, true)) : []),
          ];
        })}
      </ul>
      <Table compact className="hidden @6xl:table">
        <caption className="sr-only">
          <Trans>Contracts</Trans>
        </caption>

        <TableHeader>
          <TableHeadRow>
            <TableHead {...sortHead("name")}>
              <Trans>Contract</Trans>
            </TableHead>
            <TableHead>
              <Trans>Parties</Trans>
            </TableHead>
            <TableHead {...sortHead("term")}>
              <Trans>Term</Trans>
            </TableHead>
            <TableHead>
              <Trans>Renewal</Trans>
            </TableHead>
            <TableHead className="whitespace-nowrap text-end pe-3" {...sortHead("value")}>
              <Trans>Value</Trans>
            </TableHead>
            <TableHead className="whitespace-nowrap ps-4" {...sortHead("deadline")}>
              <Trans>Next deadline</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {rows.flatMap((row) => {
            if (row.kind === "single") return [tableRow(row.contract)];
            const isOpen = openKeys.has(row.key);
            const sum = groupSummary(row.contracts);
            return [
              <TableRow
                key={row.key}
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button")) toggle(row.key);
                }}
                className="cursor-pointer group-data-[compact]/table:h-10"
              >
                <TableCell title={row.name}>
                  <div className="flex max-w-96 items-center gap-2">
                    <span className="min-w-0 truncate font-medium">{row.name}</span>
                    <MoreButton
                      count={row.contracts.length}
                      open={isOpen}
                      onClick={() => toggle(row.key)}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  {sum.parties.length > 0 ? (
                    <ContactAvatarGroup people={parties(sum.parties)} />
                  ) : (
                    dash
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{sum.term}</TableCell>
                <TableCell className="whitespace-nowrap">{sum.renewal}</TableCell>
                <TableCell className="whitespace-nowrap text-end tabular-nums">{dash}</TableCell>
                <TableCell className="whitespace-nowrap ps-4 tabular-nums">
                  {sum.nextDeadline ? fullDay(sum.nextDeadline) : dash}
                </TableCell>
              </TableRow>,
              ...(isOpen ? row.contracts.map((contract) => tableRow(contract, true)) : []),
            ];
          })}
        </TableBody>
      </Table>
    </>
  );
}
