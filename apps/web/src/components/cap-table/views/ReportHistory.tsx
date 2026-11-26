import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityReportRun } from "@rakazo/contracts";
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
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { REPORT_TITLES } from "./ReportViewer";

/** The reports downloaded so far, newest first; Open shows one again with the same options. */
export function ReportHistory({ onOpen }: { onOpen: (run: EquityReportRun) => void }) {
  const [runs, setRuns] = useState<EquityReportRun[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc.equity.views
      .reportHistory()
      .then(setRuns)
      .catch((cause: unknown) => setError(errorText(cause)));
  }, []);

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (runs == null) return <Skeleton className="h-24 w-full" />;
  if (runs.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t`No reports yet`}</p>;
  const titles = REPORT_TITLES();
  const options = (run: EquityReportRun) =>
    run.kind === "cap_table"
      ? [
          run.groupBy === "stakeholder" ? t`By stakeholder` : t`By share class`,
          run.fullyDiluted ? t`Fully diluted` : t`Outstanding`,
          run.includeConvertibles ? t`Convertibles` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";
  const when = (iso: string) =>
    new Intl.DateTimeFormat(i18n.locale || "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  return (
    <Table>
      <TableHeader>
        <TableHeadRow>
          <TableHead>{t`Report`}</TableHead>
          <TableHead>{t`Options`}</TableHead>
          <TableHead>{t`As of`}</TableHead>
          <TableHead>{t`Generated`}</TableHead>
          <TableHead>
            <span className="sr-only">{t`Actions`}</span>
          </TableHead>
        </TableHeadRow>
      </TableHeader>
      <TableBody aria-label={t`Report history`}>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell className="font-medium">{titles[run.kind]}</TableCell>
            <TableCell className="text-muted-foreground">{options(run)}</TableCell>
            <TableCell>{run.asOf}</TableCell>
            <TableCell>{when(run.createdAt)}</TableCell>
            <TableCell className="text-end">
              <Button variant="ghost" size="sm" onClick={() => onOpen(run)}>
                {t`Open`}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
