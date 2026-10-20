import { Trans, useLingui } from "@lingui/react/macro";
import type { AccountExport } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const POLL_MS = 2000;
const active = (job: AccountExport | null) =>
  job?.status === "pending" || job?.status === "running";

/** Account settings row: request a zip of the user's own data, watch it build, then download it. */
export function DataExportSection() {
  const { t, i18n } = useLingui();
  const [job, setJob] = useState<AccountExport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    rpc.account
      .exportLatest()
      .then((next: AccountExport | null) => live && setJob(next))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const running = active(job);
  useEffect(() => {
    if (!running) return;
    let live = true;
    const timer = setInterval(() => {
      rpc.account
        .exportLatest()
        .then((next: AccountExport | null) => live && setJob(next))
        .catch(() => {});
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [running]);

  const request = async () => {
    setPending(true);
    setError("");
    try {
      setJob(await rpc.account.exportRequest());
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-border px-4 py-4"
      data-testid="data-export"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[15px] font-medium text-foreground">
          <Trans>Export my data</Trans>
        </h3>
        {running && job ? (
          <p role="status" className="text-[13px] text-muted-foreground">
            <Trans>Preparing… {job.progress}%</Trans>
          </p>
        ) : job?.status === "ready" ? (
          <p className="text-[13px] text-muted-foreground">
            <Trans>Ready until {i18n.date(new Date(job.expiresAt), { dateStyle: "medium" })}</Trans>
          </p>
        ) : null}
      </div>
      {running ? null : job?.status === "ready" ? (
        <Button
          aria-label={t`Download`}
          render={
            <a href={`/api/account/exports/${encodeURIComponent(job.id)}/download`} download />
          }
        >
          <Trans>Download</Trans>
        </Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={() => void request()}>
          <Trans>Request export</Trans>
        </Button>
      )}
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
