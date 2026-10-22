import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { percentFigure, shareCount, usdFigure } from "../../lib/finance-format";

const DASH = "—";

/** One holdings row; `contact` is the address-book entry with the same email or name, if any. */
export type HoldingRow = {
  key: string;
  name: string;
  security: string;
  shares: number | null;
  amountUsd: number | null;
  percent: number | null;
  /** The unallocated pool: no menu, no contact. */
  pool?: boolean;
  contact: { id: string } | null;
};

/** The holders of a Carta or sheet table, read-only. The typed-in table is {@link CapTableEditor}. */
export function HoldingsTable({
  rows,
  onAddContact,
  onOpenContact,
  placeholderRows = 0,
}: {
  rows: HoldingRow[];
  /** With no rows, this many static skeleton rows keep the table's layout. */
  placeholderRows?: number;
  onAddContact: (row: HoldingRow) => void;
  onOpenContact: (contactId: string) => void;
}) {
  const locale = i18n.locale || "en";
  return (
    <Table compact className="table-fixed">
      <TableHeader>
        <TableHeadRow>
          <TableHead className="ps-2">
            <Trans>Holder</Trans>
          </TableHead>
          <TableHead className="hidden w-40 @lg:table-cell">
            <Trans>Security</Trans>
          </TableHead>
          <TableHead className="hidden w-24 text-end @lg:table-cell">
            <Trans>Shares</Trans>
          </TableHead>
          <TableHead className="hidden w-24 text-end @lg:table-cell">
            <Trans>Invested</Trans>
          </TableHead>
          <TableHead className="w-24 pe-0 text-end">
            <Trans>Fully diluted</Trans>
          </TableHead>
          <TableHead className="w-10">
            <span className="sr-only">
              <Trans>Actions</Trans>
            </span>
          </TableHead>
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0
          ? Array.from({ length: placeholderRows }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder rows
              <TableRow key={i} aria-hidden="true" className="group-data-[compact]/table:h-11">
                <TableCell className="ps-2">
                  <Skeleton static className="h-2.5 w-2/5" />
                </TableCell>
                <TableCell className="hidden @lg:table-cell">
                  <Skeleton static className="h-2.5 w-14" />
                </TableCell>
                <TableCell className="hidden @lg:table-cell">
                  <Skeleton static className="ms-auto h-2.5 w-3/4" />
                </TableCell>
                <TableCell className="hidden @lg:table-cell">
                  <Skeleton static className="ms-auto h-2.5 w-3/5" />
                </TableCell>
                <TableCell className="pe-0">
                  <Skeleton static className="ms-auto h-2.5 w-11" />
                </TableCell>
                <TableCell />
              </TableRow>
            ))
          : null}
        {rows.map((row) => {
          const shares = shareCount(row.shares, locale);
          const invested = usdFigure(row.amountUsd, 0, locale);
          return (
            <TableRow
              key={row.key}
              data-contact-id={row.contact?.id}
              className="group-data-[compact]/table:h-11 [&>td]:py-0.5 [&>td:first-child]:ps-2"
            >
              <TableCell>
                {row.contact ? (
                  <button
                    type="button"
                    className="block max-w-full truncate text-start font-medium underline-offset-2 hover:underline"
                    title={row.name}
                    onClick={() => onOpenContact((row.contact as { id: string }).id)}
                  >
                    {row.name}
                  </button>
                ) : (
                  <span
                    className={`block truncate font-medium ${row.pool ? "text-muted-foreground" : ""}`}
                    title={row.name}
                  >
                    {row.name}
                  </span>
                )}
                <div className="truncate text-xs text-muted-foreground @lg:hidden">
                  {[row.security, shares, row.amountUsd != null ? invested : null]
                    .filter((part) => part !== DASH && part != null)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell className="hidden truncate text-muted-foreground @lg:table-cell">
                {row.security}
              </TableCell>
              <TableCell className="hidden text-end tabular-nums @lg:table-cell">
                {shares}
              </TableCell>
              <TableCell className="hidden text-end tabular-nums @lg:table-cell">
                {invested}
              </TableCell>
              <TableCell className="pe-0 text-end tabular-nums">
                {percentFigure(row.percent, 1)}
              </TableCell>
              <TableCell className="pe-0 text-end">
                {row.pool ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="pointer-coarse:size-11"
                          aria-label={t`Actions for ${row.name}`}
                        />
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {row.contact ? (
                        <DropdownMenuItem
                          onClick={() => onOpenContact((row.contact as { id: string }).id)}
                        >
                          <Trans>Open contact</Trans>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onAddContact(row)}>
                          <Trans>Add as contact</Trans>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          );
        })}
        {rows.some((row) => row.percent != null) ? (
          <TableRow className="group-data-[compact]/table:h-11 [&>td:first-child]:ps-2">
            <TableCell className="font-medium">
              <Trans>Total</Trans>
            </TableCell>
            <TableCell className="hidden @lg:table-cell" />
            <TableCell className="hidden @lg:table-cell" />
            <TableCell className="hidden @lg:table-cell" />
            <TableCell className="pe-0 text-end font-medium tabular-nums">
              {percentFigure(
                rows.reduce((sum, row) => sum + (row.percent ?? 0), 0),
                1,
              )}
            </TableCell>
            <TableCell />
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
