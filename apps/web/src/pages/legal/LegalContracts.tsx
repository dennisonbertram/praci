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
import type { ReactNode } from "react";
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

function Title({ contract, inline = false }: { contract: LegalContract; inline?: boolean }) {
  return (
    <>
      <Link
        to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
        className="rk-tap font-medium hover:underline"
      >
        {contract.title}
      </Link>
      {/* The wide table keeps a row to one line, so the type sits beside the title. */}
      <span className={cn("text-xs text-muted-foreground", inline ? "ms-2" : "block")}>
        {contract.contractType}
      </span>
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
  // Active is the normal case, so the column appears only when some contract is not.
  const showStatus = contracts.some((contract) => contract.status !== "active");
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
          <col className={showStatus ? "w-[21%]" : "w-[24%]"} />
          <col className={showStatus ? "w-[19%]" : "w-[21%]"} />
          {showStatus ? <col className="w-[7%]" /> : null}
          <col className={showStatus ? "w-[17%]" : "w-[18%]"} />
          <col className={showStatus ? "w-[17%]" : "w-[17%]"} />
          <col className={showStatus ? "w-[8%]" : "w-[9%]"} />
          <col className={showStatus ? "w-[11%]" : "w-[11%]"} />
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
            <TableRow key={contract.id}>
              <TableCell className="truncate" title={contract.title}>
                <Title contract={contract} inline />
              </TableCell>
              <TableCell className="truncate" title={contract.counterparties.join(", ")}>
                {contract.counterparties.join(", ") || dash}
              </TableCell>
              {showStatus ? (
                <TableCell>
                  <Status status={contract.status} />
                </TableCell>
              ) : null}
              <TableCell className="truncate tabular-nums" title={term(contract)}>
                {term(contract)}
              </TableCell>
              <TableCell className="truncate" title={renewal(contract)}>
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
