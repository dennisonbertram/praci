import { t } from "@lingui/core/macro";
import type { EquityPlanPool } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { formatDay, formatShares } from "./format";

/** Read-only history of a plan's pool increases, newest first, ending with the reserve today. */
export function PlanHistoryDialog({
  pool,
  onClose,
}: {
  pool: EquityPlanPool;
  onClose: () => void;
}) {
  const increases = [...pool.increases].sort((left, right) => right.date.localeCompare(left.date));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pool.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Date`}</TableHead>
                <TableHead className="text-right">{t`Shares added`}</TableHead>
                <TableHead>{t`Note`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {increases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {t`No increases`}
                  </TableCell>
                </TableRow>
              ) : (
                increases.map((increase) => (
                  <TableRow key={`${increase.date}-${increase.shares}`}>
                    <TableCell>{formatDay(increase.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatShares(increase.shares)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{increase.note ?? ""}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell colSpan={3}>
                  <div className="flex items-center justify-between font-medium">
                    <span>{t`Reserved`}</span>
                    <span className="tabular-nums">{formatShares(pool.reservedShares)}</span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t`Close`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
