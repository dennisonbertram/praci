import { t } from "@lingui/core/macro";
import type { EquityReportKind, EquityReportRun } from "@rakazo/contracts";
import { EQUITY_REPORT_KINDS } from "@rakazo/contracts";
import { Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EstimatedValueSettings } from "./EstimatedValueSettings";
import { HealthChecks } from "./HealthChecks";
import { ReportHistory } from "./ReportHistory";
import type { ReportOptions } from "./ReportViewer";
import { REPORT_TITLES, ReportViewer } from "./ReportViewer";

type Entry = EquityReportKind | "history" | "health" | "estimated_value";

/** The report catalog, health checks and estimated value: one entry on screen at a time. */
export function ReportsTab() {
  // The entry is in the URL (?report=voting_rights) so other tabs can link to a report.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("report") as Entry | null;
  const [entry, setEntryState] = useState<Entry>(
    fromUrl &&
      ([...EQUITY_REPORT_KINDS, "history", "health", "estimated_value"] as string[]).includes(
        fromUrl,
      )
      ? fromUrl
      : "cap_table",
  );
  const setEntry = (next: Entry) => {
    setEntryState(next);
    setParams((current) => {
      const out = new URLSearchParams(current);
      if (next === "cap_table") out.delete("report");
      else out.set("report", next);
      return out;
    });
  };
  /** Options of a report reopened from the history; a fresh pick of a report starts clean. */
  const [opened, setOpened] = useState<{ id: string; options: ReportOptions } | null>(null);
  const open = (run: EquityReportRun) => {
    setOpened({
      id: run.id,
      options: {
        asOf: run.asOf,
        groupBy: run.groupBy,
        fullyDiluted: run.fullyDiluted,
        includeConvertibles: run.includeConvertibles,
      },
    });
    setEntry(run.kind);
  };
  const titles: Record<Entry, string> = {
    ...REPORT_TITLES(),
    history: t`History`,
    health: t`Health checks`,
    estimated_value: t`Estimated value`,
  };
  const entries: Entry[] = [...EQUITY_REPORT_KINDS, "history", "health", "estimated_value"];
  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={entry}
        onValueChange={(value) => {
          setOpened(null);
          setEntry(value as Entry);
        }}
      >
        <TabsList>
          {entries.map((id) => (
            <TabsTrigger key={id} value={id}>
              {titles[id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {entry === "history" ? (
        <ReportHistory onOpen={open} />
      ) : entry === "health" ? (
        <HealthChecks />
      ) : entry === "estimated_value" ? (
        <EstimatedValueSettings />
      ) : (
        <ReportViewer key={`${entry}-${opened?.id ?? ""}`} kind={entry} initial={opened?.options} />
      )}
    </div>
  );
}
