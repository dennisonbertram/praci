import { t } from "@lingui/core/macro";
import type { FinanceTransaction } from "@rakazo/contracts";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import { useState } from "react";
import { TransactionTable } from "./ui";

/**
 * The "not counted" line above the figures. It opens the rows it is about, so a total that
 * silently leaves out euro or pound spending can be checked.
 */
export function NonUsdNotice({
  rows,
  count,
}: {
  /** The newest non-USD rows; `count` is the true total, which may be more. */
  rows: FinanceTransaction[];
  count: number;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  // One text names the trigger and the popover, so a screen reader hears what it opened.
  const label =
    count === 1
      ? t`1 non-USD transaction not counted`
      : t`${count} non-USD transactions not counted`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="link" size="xs" className="max-w-full text-muted-foreground" />}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent aria-label={label} align="start" className="w-[min(40rem,calc(100vw-2rem))]">
        <TransactionTable rows={rows} empty={t`No transactions`} />
      </PopoverContent>
    </Popover>
  );
}
