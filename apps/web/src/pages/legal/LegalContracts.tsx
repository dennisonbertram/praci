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
import type { MouseEvent, ReactNode } from "react";
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

function Title({ contract, inline = false }: { contract: LegalContract; inline?: boolean }) {
  return (
    <>
      <Link
        to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
        state={{ from: "legal" }}
        className={cn("rk-tap font-medium hover:underline", inline && "line-clamp-2")}
      >
        {contract.title}
      </Link>
      {/* The table has no room for the type: its rows are one fixed height, so the type is in the tooltip. */}
      {inline ? null : (
        <span className="block text-xs text-muted-foreground">{contract.contractType}</span>
      )}
    </>
  );
}

function Field({
  label,
  text,
  nums = false,
  children,
}: {
  label: ReactNode;
  text: string;
  nums?: boolean;
  children?: ReactNode;
}) {
  if (!text || text === dash) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(nums && "tabular-nums")}>{children ?? text}</dd>
    </>
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
function Status({
  status,
  inColumn = false,
}: {
  status: LegalContractStatus;
  /** In the Status column an empty cell reads as missing data, so active says so. */
  inColumn?: boolean;
}) {
  if (status === "active") {
    return inColumn ? <span className="text-muted-foreground">{statusName(status)}</span> : null;
  }
  return (
    <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs">
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
  useHideAmounts();
  const navigate = useNavigate();
  // Any click on a row opens the contract; the title link stays the keyboard and screen-reader target.
  const open = (contract: LegalContract) => (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    navigate(`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`, { state: { from: "legal" } });
  };
  // Active is the normal case. With one exception a chip beside the title says it; the column
  // appears only when it would hold more than one value.
  const showStatus = contracts.filter((contract) => contract.status !== "active").length >= 2;
  return (
    <>
      <ul aria-label={t`Contracts`} className="flex flex-col @4xl:hidden">
        {contracts.map((contract) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: a mouse shortcut; the title link is the keyboard way in.
          <li
            key={contract.id}
            onClick={open(contract)}
            className="cursor-pointer border-t border-border py-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Title contract={contract} />
              </div>
              <Status status={contract.status} />
            </div>
            <dl className="mt-2 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1">
              {/* A field the agent did not find is left out rather than drawn as a dash. */}
              <Field label={<Trans>Parties</Trans>} text={contract.counterparties.join(", ")} />
              <Field label={<Trans>Term</Trans>} text={term(contract)} nums />
              <Field label={<Trans>Renewal</Trans>} text={renewal(contract)} />
              <Field label={<Trans>Value</Trans>} text={value(contract)} nums />
              <Field label={<Trans>Next deadline</Trans>} text={contract.nextDeadline ?? ""} nums>
                <NextDeadline contract={contract} />
              </Field>
            </dl>
          </li>
        ))}
      </ul>
      <Table compact className="hidden table-fixed @4xl:table">
        <caption className="sr-only">
          <Trans>Contracts</Trans>
        </caption>
        <colgroup>
          <col className={showStatus ? "w-[22%]" : "w-[25%]"} />
          <col className={showStatus ? "w-[14%]" : "w-[16%]"} />
          {showStatus ? <col className="w-[7%]" /> : null}
          <col className={showStatus ? "w-[19%]" : "w-[20%]"} />
          <col className={showStatus ? "w-[17%]" : "w-[17%]"} />
          <col className="w-[8%]" />
          <col className="w-[13%]" />
        </colgroup>
        <TableHeader>
          <TableHeadRow>
            <TableHead>
              <Trans>Contract</Trans>
            </TableHead>
            <TableHead>
              <Trans>Parties</Trans>
            </TableHead>
            {showStatus ? (
              <TableHead>
                <Trans>Status</Trans>
              </TableHead>
            ) : null}
            <TableHead>
              <Trans>Term</Trans>
            </TableHead>
            <TableHead>
              <Trans>Renewal</Trans>
            </TableHead>
            <TableHead className="text-end pe-3">
              <Trans>Value</Trans>
            </TableHead>
            <TableHead className="ps-6">
              <Trans>Next deadline</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow
              key={contract.id}
              onClick={open(contract)}
              className="cursor-pointer group-data-[compact]/table:h-14"
            >
              <TableCell
                className="whitespace-normal"
                title={`${contract.title} (${contract.contractType})`}
              >
                <Title contract={contract} inline />
                {showStatus ? null : (
                  <span className="ms-2 align-middle">
                    <Status status={contract.status} />
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal" title={contract.counterparties.join(", ")}>
                <span className="line-clamp-2">{contract.counterparties.join(", ") || dash}</span>
              </TableCell>
              {showStatus ? (
                <TableCell>
                  <Status status={contract.status} inColumn />
                </TableCell>
              ) : null}
              <TableCell className="whitespace-normal tabular-nums" title={term(contract)}>
                {term(contract)}
              </TableCell>
              <TableCell className="whitespace-normal" title={renewal(contract)}>
                {renewal(contract)}
              </TableCell>
              <TableCell className="text-end tabular-nums">{value(contract)}</TableCell>
              <TableCell className="ps-6 whitespace-nowrap tabular-nums">
                <NextDeadline contract={contract} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
