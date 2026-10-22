import { t } from "@lingui/core/macro";
import type { DataRoomApiImport } from "@rakazo/contracts";
import { Button, Spinner } from "@rakazo/ui-web";
import { X } from "lucide-react";
import { failedText, importedText } from "./format";
import { isNarratedImport } from "./upload-toasts";

const sum = (entries: DataRoomApiImport[], key: "total" | "done" | "failed") =>
  entries.reduce((n, entry) => n + entry[key], 0);

/** Progress of the imports still running (a zip upload is narrated on its own card), or null. */
export function importProgress(imports: DataRoomApiImport[]) {
  const running = imports.filter((entry) => !entry.finished && !isNarratedImport(entry.id));
  return running.length > 0 ? { done: sum(running, "done"), total: sum(running, "total") } : null;
}

/**
 * One row for all of the user's imports: progress while any is running, then what the finished
 * ones filed, with the newest files to open, until it is dismissed.
 */
export function ImportActivity({
  imports,
  onOpenItem,
  onDismiss,
  hideRunning = false,
}: {
  imports: DataRoomApiImport[];
  onOpenItem: (id: string) => void;
  onDismiss: (ids: string[]) => void;
  /** The processing line shows running imports, so this row stays out of its way. */
  hideRunning?: boolean;
}) {
  // A zip upload is narrated on its own upload card.
  imports = imports.filter((entry) => !isNarratedImport(entry.id));
  if (imports.length === 0) return null;
  const running = imports.filter((entry) => !entry.finished);
  const row = "flex flex-wrap items-center gap-x-2 border-b border-border px-3 py-1.5 text-xs";
  if (running.length > 0) {
    if (hideRunning) return null;
    const done = sum(running, "done");
    const total = sum(running, "total");
    const text = t`Importing ${done} of ${total}`;
    return (
      <div role="status" className={`${row} text-muted-foreground`}>
        <Spinner aria-hidden="true" className="size-3.5" />
        <span>{text}</span>
      </div>
    );
  }
  const done = sum(imports, "done");
  const failed = sum(imports, "failed");
  // The server names the newest three; the rest are counted. ponytail: no "View" link, as no
  // filter lists just the imported files.
  const named = imports.flatMap((entry) => entry.latest).slice(0, 3);
  const unnamed = done - named.length;
  return (
    <div role="status" className={`${row} flex-nowrap items-start text-muted-foreground`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-foreground">
          {done > 0 ? importedText(done, 0) : failedText(failed)}
        </span>
        {done > 0 && failed > 0 ? <span>{failedText(failed)}</span> : null}
        {named.map((file) => (
          <Button
            key={file.id}
            variant="link"
            size="xs"
            className="h-auto max-w-full min-w-0 p-0"
            onClick={() => onOpenItem(file.id)}
          >
            <span className="truncate">{file.name}</span>
          </Button>
        ))}
        {unnamed > 0 && named.length > 0 ? <span>{t`+${unnamed} more`}</span> : null}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        aria-label={t`Dismiss`}
        onClick={() => onDismiss(imports.map((entry) => entry.id))}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
