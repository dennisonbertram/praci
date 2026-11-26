import { t } from "@lingui/core/macro";
import type { EquityOptionGrant } from "@rakazo/contracts";
import { vestingEvents, vestingRuleOf } from "@rakazo/core/equity";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { formatDay, formatPrice, formatShares } from "./format";
import { VestingChart } from "./VestingChart";

const figure = (value: string | bigint) => formatShares(value.toString());

/** The grant record: its terms, its numbers and every vesting event. */
export function OptionGrantRecord({
  grant,
  onClose,
}: {
  grant: EquityOptionGrant;
  onClose: () => void;
}) {
  const hidden = useHideAmounts();
  const schedule = grant.vestingSchedule;
  const events = schedule ? vestingEvents(vestingRuleOf(schedule), BigInt(grant.quantity)) : [];
  const terms: [string, string][] = [
    [t`Optionholder`, grant.stakeholderName],
    [t`Plan`, grant.planName],
    [t`Type`, grant.optionType.toUpperCase()],
    [t`Grant date`, formatDay(grant.grantDate)],
    [t`Exercise price`, formatPrice(grant.exercisePrice, hidden)],
    [t`Expiration`, grant.expirationDate ? formatDay(grant.expirationDate) : "—"],
    [t`Original quantity`, figure(grant.quantity)],
    [t`Vested`, figure(grant.vestedQuantity)],
    [t`Exercised`, figure(grant.exercisedQuantity)],
    [t`Canceled`, figure(grant.canceledQuantity)],
    [t`Outstanding`, figure(grant.outstandingQuantity)],
    [t`Vesting`, schedule?.description ?? "—"],
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetTitle>{grant.label}</SheetTitle>
        <SheetBody className="flex max-w-2xl flex-col gap-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {terms.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {events.length > 0 && <VestingChart events={events} total={BigInt(grant.quantity)} />}
          {events.length > 0 && (
            <Table>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Vesting date`}</TableHead>
                  <TableHead className="text-right">{t`Shares`}</TableHead>
                  <TableHead className="text-right">{t`Cumulative`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.date}>
                    <TableCell className="tabular-nums">{formatDay(event.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {figure(event.shares)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {figure(event.cumulative)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
