import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import { PickFilter, SearchField, SortControl } from "../ListControls";

const DASH = "—";

/** "default" is the order the rows arrive in. */
const HOLDING_SORTS = ["default", "holder", "security", "shares", "invested", "diluted"] as const;
type HoldingSort = (typeof HOLDING_SORTS)[number];

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
}: {
  rows: HoldingRow[];
  onAddContact: (row: HoldingRow) => void;
  onOpenContact: (contactId: string) => void;
}) {
  useHideAmounts();
  const locale = i18n.locale || "en";
  // Holder search, security filter and sort live in the URL: ?holder=, security, sort, dir.
  const list = useListParams(HOLDING_SORTS, { field: "default", dir: "asc" });
  const holder = list.param("holder");
  const security = list.param("security");
  const filtered = Boolean(holder || security);
  const needle = holder?.trim().toLowerCase();
  const kept = rows.filter(
    (row) =>
      (!needle || row.name.toLowerCase().includes(needle)) &&
      (!security || row.security === security),
  );
  const { field, dir } = list.sort;
  const pick = (row: HoldingRow) =>
    ({
      default: null,
      holder: row.name,
      security: row.security,
      shares: row.shares,
      invested: row.amountUsd,
      diluted: row.percent,
    })[field];
  // The unallocated pool stays last, whatever the sort.
  const shown =
    field === "default"
      ? kept
      : [
          ...sortBy(
            kept.filter((row) => !row.pool),
            pick,
            dir,
          ),
          ...kept.filter((row) => row.pool),
        ];
  const names: Record<Exclude<HoldingSort, "default">, string> = {
    holder: t`Holder`,
    security: t`Security`,
    shares: t`Shares`,
    invested: t`Invested`,
    diluted: t`Fully diluted`,
  };
  const head = (target: HoldingSort) => ({
    sortDirection: field === target ? dir : null,
    onSort: () => list.toggleSort(target),
  });
  const securities = [...new Set(rows.map((row) => row.security))].sort((a, b) =>
    a.localeCompare(b),
  );
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SearchField
          name="holder-search"
          className="w-56"
          value={holder ?? ""}
          onChange={(value) => list.setParam("holder", value)}
          placeholder={t`Search holders`}
          label={t`Search holders`}
        />
        <PickFilter
          label={t`Security`}
          value={security}
          options={securities.map((name) => [name, name])}
          onChange={(value) => list.setParam("security", value)}
        />
        {/* Wide, the column headers sort; narrow, most columns are hidden. */}
        <span className="ms-auto flex items-center gap-1 @lg:hidden">
          <SortControl
            fields={(Object.keys(names) as (keyof typeof names)[]).map((name) => [
              name,
              names[name],
            ])}
            field={field as keyof typeof names}
            fieldLabel={field === "default" ? t`Default` : names[field]}
            direction={field === "default" ? undefined : dir}
            onField={(next) => list.setSort({ field: next, dir: "asc" })}
            onDirection={(next) => list.setSort({ field, dir: next })}
          />
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            <Trans>No matches</Trans>
          </p>
          <Button variant="outline" size="sm" onClick={() => list.clear("holder", "security")}>
            <Trans>Clear filters</Trans>
          </Button>
        </div>
      ) : (
        <Table compact className="table-fixed">
          <TableHeader className="max-sm:hidden">
            <TableHeadRow>
              <TableHead className="ps-2" {...head("holder")}>
                <Trans>Holder</Trans>
              </TableHead>
              <TableHead className="hidden w-40 @lg:table-cell" {...head("security")}>
                <Trans>Security</Trans>
              </TableHead>
              <TableHead className="hidden w-24 text-end @lg:table-cell" {...head("shares")}>
                <Trans>Shares</Trans>
              </TableHead>
              <TableHead className="hidden w-24 text-end @lg:table-cell" {...head("invested")}>
                <Trans>Invested</Trans>
              </TableHead>
              <TableHead className="w-16 pe-0 text-end @lg:w-24" {...head("diluted")}>
                <Trans>Fully diluted</Trans>
              </TableHead>
              <TableHead className="w-11 @lg:w-10">
                <span className="sr-only">
                  <Trans>Actions</Trans>
                </span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => {
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
                        className="line-clamp-2 max-w-full text-start font-medium break-words underline-offset-2 hover:underline"
                        title={row.name}
                        onClick={() => onOpenContact((row.contact as { id: string }).id)}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <span
                        className={`line-clamp-2 font-medium break-words ${row.pool ? "text-muted-foreground" : ""}`}
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    )}
                    {/* Wraps rather than truncates, so the invested amount is never cut off. */}
                    <div className="text-xs text-muted-foreground @lg:hidden">
                      {[
                        row.security,
                        shares,
                        row.amountUsd != null ? t`${invested} invested` : null,
                      ]
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
                  {/* The header is hidden on a phone, so the fixed table takes these widths from the row. */}
                  <TableCell className="w-16 pe-0 text-end tabular-nums @lg:w-24">
                    {percentFigure(row.percent, 1)}
                  </TableCell>
                  <TableCell className="w-11 pe-0 text-end @lg:w-10">
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
            {!filtered && rows.some((row) => row.percent != null) ? (
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
      )}
    </>
  );
}
