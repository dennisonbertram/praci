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
import { Link } from "react-router-dom";
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
    <>
      <Link
        to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
        className="rk-tap font-medium hover:underline"
      >
        {contract.title}
      </Link>
      <div className="text-xs text-muted-foreground">{contract.contractType}</div>
    </>
  );
}

/** Active is the normal case and says nothing; only a contract that is not active gets a chip. */
function Status({ status }: { status: LegalContractStatus }) {
  if (status === "active") return null;
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
export function LegalContracts({ contracts }: { contracts: LegalContract[] }) {
  useHideAmounts();
  return (
    <>
      <ul aria-label={t`Contracts`} className="flex flex-col @4xl:hidden">
        {contracts.map((contract) => (
          <li key={contract.id} className="border-t border-border py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Title contract={contract} />
              </div>
              <Status status={contract.status} />
            </div>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">
                <Trans>Parties</Trans>
              </dt>
              <dd>{contract.counterparties.join(", ") || dash}</dd>
              <dt className="text-muted-foreground">
                <Trans>Term</Trans>
              </dt>
              <dd className="tabular-nums">{term(contract)}</dd>
              <dt className="text-muted-foreground">
                <Trans>Renewal</Trans>
              </dt>
              <dd>{renewal(contract)}</dd>
              <dt className="text-muted-foreground">
                <Trans>Value</Trans>
              </dt>
              <dd className="tabular-nums">{value(contract)}</dd>
              <dt className="text-muted-foreground">
                <Trans>Next deadline</Trans>
              </dt>
              <dd className="tabular-nums">
                <NextDeadline contract={contract} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>
      <Table className="hidden @4xl:table">
        <caption className="sr-only">
          <Trans>Contracts</Trans>
        </caption>
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[20%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
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
              <Trans>Status</Trans>
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
            <TableHead className="ps-6">
              <Trans>Next deadline</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow key={contract.id} className="align-top">
              <TableCell>
                <Title contract={contract} />
              </TableCell>
              <TableCell>{contract.counterparties.join(", ") || dash}</TableCell>
              <TableCell>
                <Status status={contract.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{term(contract)}</TableCell>
              <TableCell className="whitespace-nowrap">{renewal(contract)}</TableCell>
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
