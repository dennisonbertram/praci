import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { SpreadsheetPreview, SpreadsheetPreviewInput } from "@rakazo/contracts";
import { formatSheetCell, isNumericSheetCell } from "@rakazo/core";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import { useEffect, useState } from "react";
import { MASK } from "../lib/finance-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export type SheetSource = SpreadsheetPreviewInput["source"];
type Ready = Extract<SpreadsheetPreview, { status: "ready" }>;
type Cell = Ready["header"][number];

function formatCell(cell: Cell, hidden: boolean): string {
  // While amounts are hidden every numeric cell is masked, header row included (it may be data).
  if (cell !== null && hidden && isNumericSheetCell(cell)) return MASK;
  const text = formatSheetCell(cell, i18n.locale || undefined);
  return typeof cell === "string" ? maskCurrencyWhenHidden(text) : text;
}

/** CSV cells arrive as text. Big whole numbers and decimals read as numbers; IDs with a leading zero and short whole numbers such as years stay text. */
function csvCell(cell: Cell): Cell {
  if (typeof cell !== "string" || !/^-?([1-9]\d{4,14}|(0|[1-9]\d*)\.\d+)$/.test(cell)) return cell;
  return Number(cell);
}

/** "monthly_burn" and "monthlyBurn" read as "Monthly burn"; a trailing currency code reads "Value (USD)". */
function humanise(label: string): string {
  const words = label
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/ (usd|eur|gbp)$/i, (_, code: string) => ` (${code.toUpperCase()})`)
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unsupported" }
  | { status: "ready"; page: Ready; rows: Ready["rows"] };

/**
 * A read-only table of one spreadsheet (.xlsx, .xlsm, .csv, .tsv): sheet tabs, sticky column
 * letters and row numbers, and a button for the next page of rows. The server reads the file.
 * Give it a `key` of the source so a new file starts on its first sheet.
 */
export function SheetPreview({
  source,
  name,
  className,
}: {
  source: SheetSource;
  /** The file name. A .csv or .tsv opens as a plain table with its first row as the header. */
  name?: string;
  className?: string;
}) {
  const flat = /\.(csv|tsv)$/i.test(name ?? "");
  const hidden = useHideAmounts();
  const [sheet, setSheet] = useState<string | undefined>(undefined);
  const [state, setState] = useState<State>({ status: "loading" });
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const key = JSON.stringify(source);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setMore("idle");
    void rpc.files
      .spreadsheetPreview({ source, sheet })
      .then((page: SpreadsheetPreview | null) => {
        if (cancelled) return;
        if (!page || page.status === "unsupported") setState({ status: "unsupported" });
        else setState({ status: "ready", page, rows: page.rows });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: errorText(error, t`Could not load this file.`) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, sheet]);

  const loadMore = () => {
    if (state.status !== "ready") return;
    const { page, rows } = state;
    setMore("loading");
    rpc.files
      .spreadsheetPreview({ source, sheet: page.sheet, offset: rows.length })
      .then((next: SpreadsheetPreview | null) => {
        if (next?.status !== "ready") throw new Error("unsupported");
        // A page with no rows ends the sheet (a wide sheet can be cut short with nothing left).
        setState({
          status: "ready",
          page: { ...page, truncated: next.truncated && next.rows.length > 0 },
          rows: [...rows, ...next.rows],
        });
        setMore("idle");
      })
      .catch(() => setMore("error"));
  };

  if (state.status === "loading") {
    return (
      <div className={cn("flex flex-col gap-2 p-3", className)} data-testid="sheet-skeleton">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "m-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive",
          className,
        )}
      >
        {state.message}
      </div>
    );
  }
  if (state.status === "unsupported") {
    return (
      <div
        className={cn(
          "grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80",
          className,
        )}
      >
        <Trans>Preview isn't available for this file type — download it to view it.</Trans>
      </div>
    );
  }

  const { page, rows } = state;
  const empty = page.header.length === 0 && rows.length === 0;
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      {page.sheets.length > 1 ? (
        <div className="shrink-0 overflow-x-auto border-b border-border px-2 py-1.5">
          <Tabs value={page.sheet} onValueChange={(next) => setSheet(String(next))}>
            <TabsList aria-label={t`Sheets`}>
              {page.sheets.map((entry) => (
                <TabsTrigger key={entry.name} value={entry.name} className="px-3">
                  {entry.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}
      {empty ? (
        <p className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground/80">
          <Trans>This sheet is empty.</Trans>
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table
            compact
            className="w-max min-w-full border-separate border-spacing-0 text-[12.5px]"
          >
            <TableHeader>
              <TableHeadRow>
                {flat ? (
                  page.header.map((label, index) => (
                    <TableHead
                      key={index}
                      className="sticky top-0 z-10 h-8 border-b border-border bg-muted px-2 py-0 text-start"
                    >
                      {typeof label === "string" ? humanise(label) : formatCell(label, hidden)}
                    </TableHead>
                  ))
                ) : (
                  <>
                    <TableHead className="sticky start-0 top-0 z-20 h-7 w-12 border-b border-e border-border bg-muted p-0" />
                    {page.columns.map((letter) => (
                      <TableHead
                        key={letter}
                        className="sticky top-0 z-10 h-7 border-b border-e border-border bg-muted px-2 py-0 text-center"
                      >
                        {letter}
                      </TableHead>
                    ))}
                  </>
                )}
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {!flat && page.headerRow !== null ? (
                <SheetRow row={page.headerRow} cells={page.header} hidden={hidden} head />
              ) : null}
              {rows.map((entry) => (
                <SheetRow
                  key={entry.row}
                  row={entry.row}
                  cells={flat ? entry.cells.map(csvCell) : entry.cells}
                  hidden={hidden}
                  flat={flat}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {page.truncated ? (
        <div className="flex shrink-0 flex-col items-center gap-1 border-t border-border p-2">
          <Button variant="outline" size="sm" disabled={more === "loading"} onClick={loadMore}>
            <Trans>Load more</Trans>
          </Button>
          {more === "error" ? (
            <p role="alert" className="text-xs text-destructive">
              {t`Could not load more rows.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SheetRow({
  row,
  cells,
  hidden,
  head = false,
  flat = false,
}: {
  row: number;
  cells: Cell[];
  hidden: boolean;
  head?: boolean;
  flat?: boolean;
}) {
  return (
    <TableRow className={head ? "font-medium" : undefined}>
      {flat ? null : (
        <TableCell
          className={cn(
            "sticky start-0 z-10 w-12 border-b border-e border-border bg-muted px-2 py-1 text-end font-mono text-xs font-normal tabular-nums text-muted-foreground",
            head && "top-7 z-20",
          )}
        >
          {row}
        </TableCell>
      )}
      {cells.map((cell, index) => {
        const text = formatCell(cell, hidden);
        return (
          <TableCell
            key={index}
            title={text.length > 24 ? text : undefined}
            className={cn(
              "max-w-[28ch] truncate border-b border-border px-2 py-1",
              head && "sticky top-7 z-10 bg-background",
              isNumericSheetCell(cell) && "text-end font-mono tabular-nums",
            )}
          >
            {text}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
