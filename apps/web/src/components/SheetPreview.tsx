import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { SpreadsheetPreview } from "@rakazo/contracts";
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

export type SheetSource = { artifactId: string } | { dataRoomItemId: string };
type Ready = Extract<SpreadsheetPreview, { status: "ready" }>;
type Cell = Ready["header"][number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;
// CSV cells are text, so a figure such as "1,250.50" or "(12%)" is recognised by its shape.
const NUMERIC_TEXT = /^[-+(]?[$€£¥]?\s?-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?\)?$/;

const isNumeric = (cell: Cell) =>
  typeof cell === "number" || (typeof cell === "string" && NUMERIC_TEXT.test(cell.trim()));

function formatCell(cell: Cell, hidden: boolean): string {
  if (cell === null) return "";
  // While amounts are hidden every numeric cell is masked, header row included (it may be data).
  if (hidden && isNumeric(cell)) return MASK;
  if (typeof cell === "number") {
    return new Intl.NumberFormat(i18n.locale || undefined, { maximumFractionDigits: 10 }).format(
      cell,
    );
  }
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  if (ISO_DATE.test(cell)) {
    const date = new Date(cell.length === 10 ? `${cell}T00:00:00Z` : `${cell}Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(i18n.locale || undefined, {
        dateStyle: "medium",
        ...(cell.length > 10 ? { timeStyle: "short" as const } : {}),
        timeZone: "UTC",
      }).format(date);
    }
  }
  return maskCurrencyWhenHidden(cell);
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
export function SheetPreview({ source, className }: { source: SheetSource; className?: string }) {
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
                <TableHead className="sticky start-0 top-0 z-20 h-7 w-12 border-b border-e border-border bg-muted p-0" />
                {page.columns.map((letter) => (
                  <TableHead
                    key={letter}
                    className="sticky top-0 z-10 h-7 border-b border-e border-border bg-muted px-2 py-0 text-center"
                  >
                    {letter}
                  </TableHead>
                ))}
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {page.headerRow !== null ? (
                <SheetRow row={page.headerRow} cells={page.header} hidden={hidden} head />
              ) : null}
              {rows.map((entry) => (
                <SheetRow key={entry.row} row={entry.row} cells={entry.cells} hidden={hidden} />
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
}: {
  row: number;
  cells: Cell[];
  hidden: boolean;
  head?: boolean;
}) {
  return (
    <TableRow className={head ? "font-medium" : undefined}>
      <TableCell
        className={cn(
          "sticky start-0 z-10 w-12 border-b border-e border-border bg-muted px-2 py-1 text-end font-mono text-xs font-normal tabular-nums text-muted-foreground",
          head && "top-7 z-20",
        )}
      >
        {row}
      </TableCell>
      {cells.map((cell, index) => {
        const text = formatCell(cell, hidden);
        return (
          <TableCell
            key={index}
            title={text.length > 24 ? text : undefined}
            className={cn(
              "max-w-[28ch] truncate border-b border-border px-2 py-1",
              head && "sticky top-7 z-10 bg-background",
              isNumeric(cell) && "text-end font-mono tabular-nums",
            )}
          >
            {text}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
