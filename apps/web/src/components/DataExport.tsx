import { Plural, Trans, useLingui } from "@lingui/react/macro";
import type { AccountExport } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
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
  const [loadError, setLoadError] = useState(false);
  // Load, poll and retry share one order: an older answer never overrides a newer one.
  const loadSeq = useRef(0);
  const appliedSeq = useRef(0);

  useEffect(() => {
    let live = true;
    rpc.account
      .exportLatest()
      .then((next: AccountExport | null) => {
        if (!live) return;
        setJob(next);
        setLoadError(false);
      })
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  const running = active(job);
  useEffect(() => {
    if (!running) return;
    let live = true;
    let consecutiveFailures = 0;
    const timer = setInterval(() => {
      const seq = ++loadSeq.current;
      rpc.account
        .exportLatest()
        .then((next: AccountExport | null) => {
          if (!live || seq < appliedSeq.current) return;
          appliedSeq.current = seq;
          consecutiveFailures = 0;
          setJob(next);
          setLoadError(false);
        })
        .catch(() => {
          if (!live) return;
          consecutiveFailures += 1;
          if (consecutiveFailures >= 3) setLoadError(true);
        });
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [running]);

  const retryLoad = async () => {
    const seq = ++loadSeq.current;
    try {
      const next = await rpc.account.exportLatest();
      if (seq < appliedSeq.current) return;
      appliedSeq.current = seq;
      setJob(next);
      setLoadError(false);
    } catch {
      if (seq >= appliedSeq.current) setLoadError(true);
    }
  };

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
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2"
      data-testid="data-export"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-normal text-foreground/75">
          <Trans>Export my data</Trans>
        </h3>
        {running && job ? (
          <p role="status" className="text-[13px] text-muted-foreground">
            <Trans>Preparing… {job.progress}%</Trans>
          </p>
        ) : pending ? (
          <p role="status" className="text-[13px] text-muted-foreground">
            <Trans>Preparing…</Trans>
          </p>
        ) : job?.status === "failed" ? (
          <p className="text-[13px] text-destructive">
            <Trans>The export failed. Try again.</Trans>
          </p>
        ) : job?.status === "ready" ? (
          <>
            <p className="text-[13px] text-muted-foreground">
              <Trans>
                Ready until {i18n.date(new Date(job.expiresAt), { dateStyle: "medium" })}
              </Trans>
            </p>
            {job.missingFiles && job.missingFiles > 0 ? (
              <p className="text-[13px] text-muted-foreground">
                <Plural value={job.missingFiles} one="# file missing" other="# files missing" />
              </p>
            ) : null}
          </>
        ) : null}
        {loadError ? (
          <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
            <span>
              <Trans>Could not load</Trans>
            </span>
            <Button variant="ghost" onClick={() => void retryLoad()}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : null}
      </div>
      {running || loadError ? null : job?.status === "ready" && !pending ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void request()}>
            <Trans>Request new export</Trans>
          </Button>
          <Button
            aria-label={t`Download`}
            render={
              <a href={`/api/account/exports/${encodeURIComponent(job.id)}/download`} download />
            }
          >
            <Trans>Download</Trans>
          </Button>
        </div>
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
