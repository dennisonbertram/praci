import { plural, t } from "@lingui/core/macro";
import type { DataRoomApiProcessing } from "@rakazo/contracts";
import { Button, cn, Spinner } from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { maskCurrencyWhenHidden } from "../../lib/hide-amounts-preference";
import { Shimmer } from "../ai/primitives";

export const processingRemaining = (p: DataRoomApiProcessing) => p.reading + p.tagging + p.indexing;

/**
 * One slim line at the top of the list while files are still being read, tagged and indexed:
 * how many are left, a thin bar of how far the batch has come, and per-step counts on demand.
 * `total` is the most files left at once since the batch began; `finished` shows the brief
 * "All files processed" before the page hides the strip.
 */
export function ProcessingStrip({
  processing,
  total,
  finished = false,
  importing,
}: {
  processing: DataRoomApiProcessing;
  total: number;
  finished?: boolean;
  /** Imports still running, shown ahead of the count on the same line. */
  importing?: { done: number; total: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const remaining = processingRemaining(processing);
  const row = "border-b border-border px-3 py-1.5 text-xs text-muted-foreground";
  if (finished) {
    return (
      <div role="status" className={row}>
        <span className="text-foreground">{t`All files processed`}</span>
      </div>
    );
  }
  const percent = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;
  const steps = [
    { label: t`Reading text`, count: processing.reading },
    { label: t`Indexing for search`, count: processing.indexing },
    { label: t`Tagging`, count: processing.tagging },
  ].filter((step) => step.count > 0);
  // The step the current file is in: the earliest one that still has files.
  const doing = processing.reading
    ? t`Reading`
    : processing.indexing
      ? t`Indexing`
      : processing.tagging
        ? t`Tagging`
        : null;
  if (remaining === 0 && !importing) return null;
  return (
    <div role="status" className={cn(row, "relative", percent > 0 && "pb-2")}>
      {/* One line at any width: only the file name gives way. */}
      <div className="flex items-center gap-x-2 whitespace-nowrap">
        {importing ? (
          <>
            <Spinner aria-hidden="true" className="size-3.5" />
            <span>{t`Importing ${importing.done} of ${importing.total}`}</span>
            {remaining > 0 ? <span aria-hidden="true">·</span> : null}
          </>
        ) : null}
        {remaining > 0 ? (
          <span className="shrink-0">
            <Shimmer>
              {plural(remaining, { one: "Processing # file", other: "Processing # files" })}
            </Shimmer>
          </span>
        ) : null}
        {remaining > 0 && processing.current && doing ? (
          <span className="min-w-0 truncate">
            {doing} {maskCurrencyWhenHidden(processing.current)}
          </span>
        ) : null}
        {remaining > 0 ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="ms-auto"
            aria-label={t`Details`}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown aria-hidden="true" className={cn(open && "rotate-180")} />
          </Button>
        ) : null}
      </div>
      {open && remaining > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {steps.map((step) => (
            <li key={step.label} className="flex justify-between tabular-nums">
              <span>{step.label}</span>
              <span>{step.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {remaining > 0 && percent > 0 ? (
        <div
          role="progressbar"
          aria-label={t`Processing`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-border"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
