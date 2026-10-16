import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalContract, LegalContractStatus } from "@rakazo/contracts";
import { cn } from "@rakazo/ui-web";
import { Link } from "react-router-dom";
import { Th } from "../../components/finance/ui";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay, shortDay } from "../../lib/finance-format";
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

/** Every contract the Legal agent found, with a link to its document in the Data room. */
export function LegalContracts({ contracts }: { contracts: LegalContract[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <caption className="sr-only">
          <Trans>Contracts</Trans>
        </caption>
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
                <Link
                  to={`${DATA_ROOM_PATH}?item=${contract.dataRoomItemId}`}
                  className="font-medium hover:underline"
                >
                  {contract.title}
                </Link>
                <div className="text-xs text-muted-foreground">{contract.contractType}</div>
              </td>
              <td>{contract.counterparties.join(", ") || dash}</td>
              <td>
                <span
                  className={cn(
                    "rounded-full border border-border px-2 py-0.5 text-xs",
                    contract.status === "active" && "border-success text-success",
                  )}
                >
                  {statusName(contract.status)}
                </span>
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {contract.effectiveDate || contract.expirationDate
                  ? `${contract.effectiveDate ? fullDay(contract.effectiveDate) : dash} – ${
                      contract.expirationDate ? fullDay(contract.expirationDate) : dash
                    }`
                  : dash}
              </td>
              <td>{renewal(contract)}</td>
              <td className="whitespace-nowrap text-end tabular-nums">
                {contract.valueCents === null
                  ? dash
                  : contractValue(contract.valueCents, contract.currency)}
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {contract.nextDeadline ? shortDay(contract.nextDeadline) : dash}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
