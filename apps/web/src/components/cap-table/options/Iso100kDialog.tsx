import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { iso100k } from "@rakazo/core/equity";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

const locale = () => i18n.locale || "en";

/** A cent amount as dollars with two decimals, built from BigInt so no float rounds it. */
const money = (cents: bigint) => {
  const whole = new Intl.NumberFormat(locale()).format(cents / 100n);
  return `$${whole}.${(cents % 100n).toString().padStart(2, "0")}`;
};

/** The ISO 100K report: each holder's ISO value first exercisable per year and its excess. */
export function Iso100kDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ReturnType<typeof iso100k> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    rpc.equity.optionGrants
      .list({ pageSize: 500 })
      .then((page) => {
        if (!live) return;
        setRows(
          iso100k(
            page.items.map((grant) => ({
              stakeholderId: grant.stakeholderId,
              stakeholderName: grant.stakeholderName,
              optionType: grant.optionType,
              quantity: grant.quantity,
              exercisePrice: grant.exercisePrice,
              grantDate: grant.grantDate,
              earlyExercise: grant.earlyExercise,
              status: grant.status,
              vestingSchedule: grant.vestingSchedule,
            })),
          ),
        );
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t`ISO 100K`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {rows == null && !error && <p className="text-sm text-muted-foreground">{t`Loading`}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {rows != null && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">{t`No ISO grants`}</p>
          )}
          {rows != null && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableHeadRow>
                  <TableHead className="whitespace-nowrap">{t`Holder`}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t`Year`}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t`ISO value first exercisable`}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t`Over the limit`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const over = row.overLimitCents > 0n;
                  return (
                    <TableRow key={`${row.stakeholderId}-${row.year}`}>
                      <TableCell className="whitespace-nowrap">{row.stakeholderName}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.year}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums${over ? " text-destructive" : ""}`}
                      >
                        {money(row.valueCents)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums${over ? " text-destructive" : ""}`}
                      >
                        {over ? money(row.overLimitCents) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
