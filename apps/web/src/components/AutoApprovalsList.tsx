import { Trans, useLingui } from "@lingui/react/macro";
import type { AutoApproval } from "@rakazo/contracts";
import { toolStepLabel } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** Calls approved without a card, each with Undo where the tool has one. Hidden while empty. */
export function AutoApprovalsList() {
  const { t } = useLingui();
  const [rows, setRows] = useState<AutoApproval[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    try {
      setRows((await rpc.autoReview.approvals()).rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, t`Could not load approvals`));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function undo(id: string) {
    setBusy(id);
    setFailed(null);
    try {
      await rpc.autoReview.undo({ id });
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, undoable: false, undone: true } : row)),
      );
    } catch (err) {
      setFailed({ id, message: errorText(err, t`Could not undo`) });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0 && !loadError) return null;
  return (
    <section
      className="rounded-xl border border-border px-4 py-4"
      data-testid="auto-approvals"
      aria-labelledby="auto-approvals-title"
    >
      <h3 id="auto-approvals-title" className="text-[15px] font-medium text-foreground">
        <Trans>Approved automatically</Trans>
      </h3>
      {loadError ? (
        <div className="mt-2">
          <p role="alert" className="text-[13px] text-destructive">
            {loadError}
          </p>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void load()}>
            <Trans>Retry</Trans>
          </Button>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 text-[13px]">
            <span className="min-w-0 text-foreground/75">
              <span className="break-words">
                {toolStepLabel(row.tool)}
                {row.target ? ` · ${row.target}` : ""}
              </span>
              <span className="block text-[12px] text-muted-foreground">
                {row.botName} · {formatRelativeTime(row.at)}
              </span>
            </span>
            {failed?.id === row.id ? (
              <span role="alert" className="shrink-0 text-[12px] text-destructive">
                {failed.message}
              </span>
            ) : row.undone ? (
              <span className="shrink-0 text-[12px] text-muted-foreground">
                <Trans>Undone</Trans>
              </span>
            ) : row.undoable ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto shrink-0 p-0 text-[13px] text-foreground"
                disabled={busy === row.id}
                onClick={() => void undo(row.id)}
              >
                {t`Undo`}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
