import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { CleanupKind, CleanupListOutput, MailAction } from "@rakazo/contracts";
import {
  type CleanupApi,
  type CleanupFailure,
  type CleanupRunResult,
  cleanupChoiceCounts,
  cleanupTargets,
  runCleanup,
  senderKey,
} from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Skeleton,
} from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { PageHeader } from "../PageHeader";
import { CleanupActionBar } from "./CleanupActionBar";
import { CleanupHistory } from "./CleanupHistory";
import { CleanupSenderRow } from "./CleanupSenderRow";

const api: CleanupApi = {
  archive: (input) => rpc.inbox.cleanup.archive(input),
  unsubscribe: (input) => rpc.inbox.unsubscribe(input),
};
// Long enough to read the toast and reach its Undo.
const TOAST_MS = 10_000;

interface Outcome {
  failed: CleanupFailure[];
  links: CleanupRunResult["openLinks"];
}

/**
 * Senders ranked by unopened mail, with bulk and rarely read ones ticked. One choice applies to the
 * ticked senders: archive their inbox mail, unsubscribe (and archive), or skip the inbox from now on.
 */
export function InboxCleanup({
  connectionId,
  onBack,
  onRefreshed,
}: {
  connectionId?: string;
  onBack: () => void;
  /** Called after mail changed, so the sidebar can refresh its unread count. */
  onRefreshed: () => void;
}) {
  const { t } = useLingui();
  const [list, setList] = useState<CleanupListOutput | null>(null);
  const [history, setHistory] = useState<MailAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirming, setConfirming] = useState<CleanupRunResult["confirm"]>([]);
  const [toast, setToast] = useState<{ text: string; batchIds: string[] } | null>(null);
  const [undoing, setUndoing] = useState<string>();
  const seeded = useRef(false);

  const load = useCallback(async () => {
    try {
      const [next, actions] = await Promise.all([
        rpc.inbox.cleanup.list({ ...(connectionId ? { connectionId } : {}) }),
        rpc.inbox.actions.list({}),
      ]);
      setError(null);
      setList(next);
      setHistory(actions.actions);
      const keys = new Set(next.senders.map((s) => senderKey(s.connectionId, s.address)));
      // The first answer ticks the preselected senders; later ones keep what the user ticked.
      const first = !seeded.current;
      setSelected((now) =>
        !first
          ? new Set([...now].filter((key) => keys.has(key)))
          : new Set(
              next.senders
                .filter((s) => s.preselected)
                .map((s) => senderKey(s.connectionId, s.address)),
            ),
      );
      seeded.current = true;
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [connectionId]);

  useEffect(() => {
    seeded.current = false;
    setList(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const senders = list?.senders ?? [];
  const counts = useMemo(() => cleanupChoiceCounts(senders, selected), [senders, selected]);
  const accountLabels = new Map((list?.accounts ?? []).map((a) => [a.connectionId, a.label]));
  const manyAccounts = (list?.accounts.length ?? 0) > 1;

  const toastFor = (kind: CleanupKind, result: CleanupRunResult, attempted: number) => {
    const senderCount = attempted - result.failed.length - result.confirm.length;
    if (kind === "skip_inbox")
      return plural(senderCount, {
        one: "Skipping inbox for # sender",
        other: "Skipping inbox for # senders",
      });
    if (kind === "unsubscribe") return t`Unsubscribed from ${senderCount}`;
    if (kind === "spam") return t`Marked ${result.done} as spam`;
    return t`Archived ${result.done}`;
  };

  const finish = async (kind: CleanupKind, result: CleanupRunResult, attempted: number) => {
    setOutcome((before) => ({
      failed: [...(before?.failed ?? []), ...result.failed],
      links: [...(before?.links ?? []), ...result.openLinks],
    }));
    setConfirming((rest) => [...rest, ...result.confirm]);
    const worked = attempted - result.failed.length - result.confirm.length;
    if (
      worked > 0 &&
      (result.batchIds.length > 0 || kind === "skip_inbox" || kind === "unsubscribe")
    )
      setToast({ text: toastFor(kind, result, attempted), batchIds: result.batchIds });
    if (result.done > 0 || worked > 0) onRefreshed();
    await load();
  };

  const apply = async (kind: CleanupKind) => {
    const targets = cleanupTargets(kind, senders, selected);
    if (targets.length === 0 || busy) return;
    setBusy(true);
    setOutcome(null);
    setToast(null);
    try {
      await finish(kind, await runCleanup(kind, targets, api), targets.length);
    } finally {
      setBusy(false);
    }
  };

  const sendMailto = async (send: boolean) => {
    const [next] = confirming;
    if (!next) return;
    setConfirming((rest) => rest.slice(1));
    if (!send) return;
    setBusy(true);
    try {
      await finish(
        "unsubscribe",
        await runCleanup("unsubscribe", [next.sender], api, { confirmMailto: true }),
        1,
      );
    } finally {
      setBusy(false);
    }
  };

  const undo = async (batchIds: string[]) => {
    setToast(null);
    setUndoing(batchIds[0]);
    try {
      await Promise.all(batchIds.map((batchId) => rpc.inbox.actions.undo({ batchId })));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setUndoing(undefined);
      onRefreshed();
      await load();
    }
  };

  const stop = async (connection: string, address: string) => {
    try {
      await rpc.inbox.cleanup.forget({ connectionId: connection, address });
    } catch (cause) {
      setError(errorText(cause));
    }
    await load();
  };

  const toggle = (key: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const failureLine = (failure: CleanupFailure) => {
    const name = failure.sender.name;
    return failure.reason === "archive" || failure.reason === "error"
      ? t`Couldn't update ${name}`
      : t`Couldn't unsubscribe from ${name}`;
  };

  return (
    <div
      data-inbox-cleanup
      className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-20 pt-2 md:px-7 md:pt-5 xl:px-10"
    >
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label={t`Back`} onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
            </Button>
            <Trans>Cleanup</Trans>
          </span>
        }
      />

      {error && !list ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 py-8 text-sm text-muted-foreground"
        >
          <p>
            <Trans>Couldn't load senders</Trans>
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : !list ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {error ? (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {senders.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              <Trans>Nothing to clean up</Trans>
            </p>
          ) : (
            <>
              <CleanupActionBar counts={counts} busy={busy} onApply={apply} />
              <div className="border-t border-foreground/10">
                {senders.map((sender) => {
                  const key = senderKey(sender.connectionId, sender.address);
                  return (
                    <CleanupSenderRow
                      key={key}
                      sender={sender}
                      checked={selected.has(key)}
                      onToggle={() => toggle(key)}
                      accountLabel={
                        manyAccounts ? accountLabels.get(sender.connectionId) : undefined
                      }
                      onStop={() => void stop(sender.connectionId, sender.address)}
                      disabled={busy}
                    />
                  );
                })}
              </div>
            </>
          )}
          {outcome && (outcome.failed.length > 0 || outcome.links.length > 0) ? (
            <ul role="status" className="mt-3 flex flex-col gap-1.5 text-sm">
              {outcome.failed.map((failure) => (
                <li
                  key={`${failure.sender.connectionId}:${failure.sender.address}:${failure.reason}`}
                  className="flex flex-wrap items-center gap-x-3 text-destructive"
                >
                  <span dir="auto">{failureLine(failure)}</span>
                  {failure.reason === "unsubscribe" && failure.openUrl ? (
                    <OpenLink url={failure.openUrl} />
                  ) : null}
                </li>
              ))}
              {outcome.links.map((link) => (
                <li
                  key={`${link.sender.connectionId}:${link.sender.address}:link`}
                  className="flex flex-wrap items-center gap-x-3"
                >
                  <span dir="auto" className="text-muted-foreground">
                    {link.sender.name}
                  </span>
                  <OpenLink url={link.url} />
                </li>
              ))}
            </ul>
          ) : null}
          <CleanupHistory
            actions={history}
            busyBatchId={undoing}
            onUndo={(batchId) => void undo([batchId])}
          />
        </>
      )}

      <AlertDialog
        open={confirming.length > 0}
        onOpenChange={(open) => !open && void sendMailto(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t`Send an unsubscribe email to ${confirming[0]?.mailTo ?? ""}?`}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void sendMailto(true)}>
              <Trans>Send</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex justify-center px-4"
      >
        {toast ? (
          <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-lg bg-primary py-1 ps-3 pe-1 text-sm text-primary-foreground shadow-lg">
            <span className="min-w-0 truncate">{toast.text}</span>
            {toast.batchIds.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => void undo(toast.batchIds)}>
                <Trans>Undo</Trans>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The user's own click opens the sender's unsubscribe page, since a tab opened after a request is blocked. */
function OpenLink({ url }: { url: string }) {
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto p-0"
      render={<a href={url} target="_blank" rel="noopener noreferrer" />}
    >
      <Trans>Open link</Trans>
    </Button>
  );
}
