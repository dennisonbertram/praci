import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalContract, LegalContractStatus } from "@rakazo/contracts";
import {
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay, hiddenOr } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { contractValue, daysBetween, todayIso } from "../../lib/legal-format";

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

function Title({ contract }: { contract: LegalContract }) {
  return (
    <Link
      to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
      state={{ from: "legal" }}
      className="rk-tap min-w-0 truncate font-medium hover:underline"
    >
      {contract.title}
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

/**
 * Every contract the Legal agent found, with a link to its document in the Data room. Wide, a
 * table with fixed column widths (so hiding amounts does not move the columns); narrow, one card
 * per contract, so nothing is cut off at the side.
 */
export function LegalContracts({
  contracts: all,
  selfName,
}: {
  contracts: LegalContract[];
  /** The company itself: every contract is with it, so it is left out of Parties. */
  selfName?: string;
}) {
  const contracts = all.map((contract) => withoutSelf(contract, selfName));
  const hidden = useHideAmounts();
  const navigate = useNavigate();
  // Any click on a row opens the contract; the title link stays the keyboard and screen-reader target.
  const open = (contract: LegalContract) => (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    navigate(`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`, { state: { from: "legal" } });
  };
  return (
    <>
      <ul aria-label={t`Contracts`} className="flex flex-col @4xl:hidden">
        {contracts.map((contract) => {
          const parties = contract.counterparties.join(", ");
          const showValue = !hidden && contract.valueCents !== null;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: a mouse shortcut; the title link is the keyboard way in.
            <li
              key={contract.id}
              onClick={open(contract)}
              className="cursor-pointer border-t border-border py-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <Title contract={contract} />
                <span className="flex shrink-0 items-center gap-2">
                  {showValue ? <span className="tabular-nums">{value(contract)}</span> : null}
                  <Status status={contract.status} />
                </span>
              </div>
              {/* Only what the agent found: no labels, since the values say what they are. */}
              {parties ? <p className="truncate text-xs text-muted-foreground">{parties}</p> : null}
              <p className="text-xs text-muted-foreground">
                {[term(contract), renewal(contract)].filter((text) => text !== dash).join(" · ")}
                {contract.nextDeadline ? (
                  <>
                    {" · "}
                    <Trans>Due</Trans> <NextDeadline contract={contract} />
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
      <Table compact className="hidden table-fixed @4xl:table">
        <caption className="sr-only">
          <Trans>Contracts</Trans>
        </caption>
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[19%]" />
          <col className="w-[16%]" />
          <col className="w-[17%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader>
          <TableHeadRow>
            <TableHead>
              <Trans>Contract</Trans>
            </TableHead>
            <TableHead>
              <Trans>Parties</Trans>
            </TableHead>
            <TableHead>
              <Trans>Term</Trans>
            </TableHead>
            <TableHead>
              <Trans>Renewal</Trans>
            </TableHead>
            <TableHead className="text-end pe-3">
              <Trans>Value</Trans>
            </TableHead>
            <TableHead className="ps-4">
              <Trans>Next deadline</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow
              key={contract.id}
              onClick={open(contract)}
              className="cursor-pointer group-data-[compact]/table:h-12"
            >
              <TableCell title={`${contract.title} (${contract.contractType})`}>
                <div className="flex items-center gap-2">
                  <Title contract={contract} />
                  <Status status={contract.status} />
                </div>
              </TableCell>
              <TableCell className="truncate" title={contract.counterparties.join(", ")}>
                {contract.counterparties.join(", ") || dash}
              </TableCell>
              <TableCell className="truncate tabular-nums" title={term(contract)}>
                {term(contract)}
              </TableCell>
              <TableCell className="truncate" title={renewal(contract)}>
                {renewal(contract)}
              </TableCell>
              <TableCell className="text-end tabular-nums">{value(contract)}</TableCell>
              <TableCell className="ps-4 truncate tabular-nums">
                <NextDeadline contract={contract} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
