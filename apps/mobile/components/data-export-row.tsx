import type { AccountExport } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { rpc } from "../lib/api";
import { shareDataExport } from "../lib/data-export";
import { dateLocaleForUi, t } from "../lib/i18n";
import { errorText } from "../lib/user-error";
import { SettingsRow } from "./settings-group";

const POLL_MS = 2000;
const isActive = (job: AccountExport | null) =>
  job?.status === "pending" || job?.status === "running";

/** Settings row: request a zip of the user's own data, then share it from the system share sheet. */
export function DataExportRow({ onError }: { onError: (message: string | null) => void }) {
  const [job, setJob] = useState<AccountExport | null>(null);
  const [busy, setBusy] = useState(false);
  const running = isActive(job);

  useEffect(() => {
    let live = true;
    const load = () =>
      rpc<AccountExport | null>("account/exportLatest")
        .then((next) => live && setJob(next))
        .catch(() => {});
    void load();
    const timer = running ? setInterval(load, POLL_MS) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [running]);

  const press = async () => {
    setBusy(true);
    onError(null);
    try {
      if (job?.status === "ready") await shareDataExport(job.id);
      else setJob(await rpc<AccountExport>("account/exportRequest"));
    } catch (error) {
      onError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const ready = job?.status === "ready";
  return (
    <SettingsRow
      accessibilityRole="button"
      disabled={busy || running}
      onPress={() => void press()}
      title={ready ? t("Download") : t("Export my data")}
      value={
        running && job
          ? t("Preparing… {progress}%", { progress: job.progress })
          : ready
            ? t("Ready until {date}", {
                date: new Date(job.expiresAt).toLocaleDateString(dateLocaleForUi(), {
                  dateStyle: "medium",
                }),
              })
            : undefined
      }
    />
  );
}
