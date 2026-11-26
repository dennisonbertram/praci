import { t } from "@lingui/core/macro";
import type {
  EquityReport,
  EquityReportFormat,
  EquityReportInput,
  EquityReportKind,
} from "@rakazo/contracts";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay } from "../options/format";
import { downloadText } from "./download";
import { formatPercent, formatPrice } from "./format";

export const REPORT_TITLES = (): Record<EquityReportKind, string> => ({
  cap_table: t`Cap table`,
  stakeholder_ledger: t`Stakeholder ledger`,
  securities_ledger: t`Securities ledger`,
  option_holders: t`Option holders`,
  vesting: t`Vesting`,
  cash_raised: t`Cash raised`,
  voting_rights: t`Voting rights`,
});

/** Integer strings get thousands separators on screen; the CSV keeps the raw digits. */
/** Money with cents, e.g. "123456" -> "$1,234.56". */
const centsText = (cents: string) =>
  `$${new Intl.NumberFormat("en").format(BigInt(cents) / 100n)}.${(BigInt(cents) % 100n).toString().padStart(2, "0")}`;

/** "outstanding" -> "Outstanding", "semi_annually" -> "Semi annually". */
const statusText = (value: string) => {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Each column's format decides how its cell reads on screen; the CSV keeps exact values. */
const display = (value: string | null, format: EquityReportFormat, hideAmounts = false) => {
  if (value == null || value === "") return "—";
  switch (format) {
    case "shares":
      return /^\d+$/.test(value) ? new Intl.NumberFormat("en").format(BigInt(value)) : value;
    case "cents":
      return /^\d+$/.test(value) ? (hideAmounts ? "$•••" : centsText(value)) : value;
    case "price":
      return /^\d+(\.\d+)?$/.test(value) ? formatPrice(value, hideAmounts) : value;
    case "percent":
      return /^\d+(\.\d+)?$/.test(value) ? formatPercent(value) : value;
    case "decimal":
      return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
    case "status":
      return statusText(value);
    default:
      // Dates read as on every other tab ("Mar 4, 2025"); the CSV keeps YYYY-MM-DD.
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDay(value) : value;
  }
};

/** One report: its options, the table on screen, and the CSV download. */
export type ReportOptions = {
  asOf?: string;
  groupBy?: "share_class" | "stakeholder";
  fullyDiluted?: boolean;
  includeConvertibles?: boolean;
};

export function ReportViewer({
  kind,
  initial = {},
}: {
  kind: EquityReportKind;
  /** Options to open with, e.g. a report reopened from the history. */
  initial?: ReportOptions;
}) {
  const hideAmounts = useHideAmounts();
  const [asOf, setAsOf] = useState(initial.asOf ?? "");
  const [groupBy, setGroupBy] = useState<"share_class" | "stakeholder">(
    initial.groupBy ?? "share_class",
  );
  const [fullyDiluted, setFullyDiluted] = useState(initial.fullyDiluted ?? true);
  const [includeConvertibles, setIncludeConvertibles] = useState(
    initial.includeConvertibles ?? true,
  );
  const [result, setResult] = useState<EquityReport | null>(null);
  const [error, setError] = useState("");
  // A double click must not record the report twice in the history.
  const downloading = useRef(false);
  const input = (): EquityReportInput => ({
    kind,
    ...(asOf ? { asOf } : {}),
    ...(kind === "cap_table" ? { groupBy, fullyDiluted, includeConvertibles } : {}),
    ...(kind === "voting_rights" ? { groupBy } : {}),
  });

  useEffect(() => {
    let live = true;
    setResult(null);
    setError("");
    rpc.equity.views
      .report(input())
      .then((loaded: EquityReport) => {
        if (live) setResult(loaded);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [kind, asOf, groupBy, fullyDiluted, includeConvertibles]);

  /** Downloads the CSV and adds the report to the history. */
  const download = async () => {
    if (downloading.current) return;
    downloading.current = true;
    try {
      const recorded = await rpc.equity.views.report({ ...input(), record: true });
      downloadText(`${kind.replaceAll("_", "-")}-${recorded.asOf}.csv`, recorded.csv);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      downloading.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          aria-label={t`As of`}
          className="w-auto"
          value={asOf || result?.asOf || ""}
          onChange={(event) => setAsOf(event.target.value)}
        />
        {kind === "voting_rights" ? (
          <NativeSelect
            aria-label={t`Group by`}
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
          >
            <NativeSelectOption value="share_class">{t`By share class`}</NativeSelectOption>
            <NativeSelectOption value="stakeholder">{t`By stakeholder`}</NativeSelectOption>
          </NativeSelect>
        ) : null}
        {kind === "cap_table" ? (
          <>
            <NativeSelect
              aria-label={t`Group by`}
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
            >
              <NativeSelectOption value="share_class">{t`By share class`}</NativeSelectOption>
              <NativeSelectOption value="stakeholder">{t`By stakeholder`}</NativeSelectOption>
            </NativeSelect>
            <Label className="gap-2 font-normal">
              <Switch checked={fullyDiluted} onCheckedChange={setFullyDiluted} />
              {t`Fully diluted`}
            </Label>
            <Label className="gap-2 font-normal">
              <Switch checked={includeConvertibles} onCheckedChange={setIncludeConvertibles} />
              {t`Convertibles`}
            </Label>
          </>
        ) : null}
        <Button
          className="ms-auto"
          variant="outline"
          size="sm"
          disabled={!result}
          onClick={() => void download()}
        >
          {t`Download CSV`}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : result == null ? (
        <Skeleton className="h-40 w-full" />
      ) : result.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t`Nothing to report`}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table compact className="whitespace-nowrap">
            <TableHeader>
              <TableHeadRow>
                {result.columns.map((column) => (
                  <TableHead key={column.key} className={column.numeric ? "text-end" : undefined}>
                    {column.label}
                  </TableHead>
                ))}
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={REPORT_TITLES()[kind]}>
              {result.rows.map((row, index) => (
                <TableRow key={index}>
                  {result.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={column.numeric ? "text-end tabular-nums" : undefined}
                    >
                      {display(row[column.key] ?? null, column.format, hideAmounts)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
