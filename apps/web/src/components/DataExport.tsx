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
  const requestButton = (variant: "outline" | "ghost") => (
    <Button variant={variant} disabled={pending} onClick={() => void request()}>
      <Trans>Export my data</Trans>
    </Button>
  );

  return (
    <section
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-4"
      data-testid="data-export"
    >
      {running && job ? (
        <span role="status" className="text-[14px] text-foreground/75">
          <Trans>Preparing… {job.progress}%</Trans>
        </span>
      ) : job?.status === "ready" ? (
        <>
          <Button
            aria-label={t`Download`}
            render={
              <a href={`/api/account/exports/${encodeURIComponent(job.id)}/download`} download />
            }
          >
            <Trans>Download</Trans>
          </Button>
          <span className="text-[13px] text-muted-foreground">
            <Trans>Ready until {i18n.date(new Date(job.expiresAt), { dateStyle: "medium" })}</Trans>
          </span>
          {requestButton("ghost")}
        </>
      ) : (
        requestButton("outline")
      )}
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
