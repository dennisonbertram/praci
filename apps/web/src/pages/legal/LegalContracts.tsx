import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalContract, LegalContractStatus } from "@rakazo/contracts";
import { cn } from "@rakazo/ui-web";
import { Link } from "react-router-dom";
import { Th } from "../../components/finance/ui";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay, hiddenOr } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { contractValue } from "../../lib/legal-format";

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

const nextDeadline = (contract: LegalContract) =>
  contract.nextDeadline ? fullDay(contract.nextDeadline) : dash;

function Title({ contract }: { contract: LegalContract }) {
  return (
    <>
      <Link
        to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
        className="font-medium hover:underline"
      >
        {contract.title}
      </Link>
      <div className="text-xs text-muted-foreground">{contract.contractType}</div>
    </>
  );
}

function Status({ status }: { status: LegalContractStatus }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs",
        status === "active" && "border-success text-success",
      )}
    >
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
              <dd className="tabular-nums">{nextDeadline(contract)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full table-fixed border-collapse text-sm @4xl:table">
        <caption className="sr-only">
          <Trans>Contracts</Trans>
        </caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
          <col className="w-[18%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr>
            <Th>
              <Trans>Contract</Trans>
            </Th>
            <Th>
              <Trans>Parties</Trans>
            </Th>
            <Th>
              <Trans>Status</Trans>
            </Th>
            <Th>
              <Trans>Term</Trans>
            </Th>
            <Th>
              <Trans>Renewal</Trans>
            </Th>
            <Th right className="pe-3">
              <Trans>Value</Trans>
            </Th>
            <Th>
              <Trans>Next deadline</Trans>
            </Th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr
              key={contract.id}
              className="border-t border-border align-top [&>td]:py-2 [&>td]:pe-3"
            >
              <td>
                <Title contract={contract} />
              </td>
              <td>{contract.counterparties.join(", ") || dash}</td>
              <td>
                <Status status={contract.status} />
              </td>
              <td className="tabular-nums">{term(contract)}</td>
              <td>{renewal(contract)}</td>
              <td className="text-end tabular-nums">{value(contract)}</td>
              <td className="tabular-nums">{nextDeadline(contract)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
