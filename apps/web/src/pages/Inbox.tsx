import { i18n } from "@lingui/core";
import { Trans } from "@lingui/react/macro";
import type { InboxListOutput, MailRow } from "@rakazo/contracts";
import { groupInbox } from "@rakazo/core";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SandboxedHtmlViewer } from "../components/SandboxedHtmlViewer";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const ALL = "all";

/** Time of day for today's mail, month and day otherwise. */
function formatMailTime(iso: string, today: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = i18n.locale || "en";
  return today
    ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function InboxPage({
  onConnectMail,
  onRefreshed,
  paused,
}: {
  onConnectMail: () => void;
  /** Called after a sync so the sidebar can refresh its unread count. */
  onRefreshed: () => void;
  /** True while the Integrations overlay is open; the page reloads when it closes. */
  paused: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const openId = params.get("mail");
  const [tab, setTab] = useState<string | undefined>();
  const [data, setData] = useState<InboxListOutput | null>(null);
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.inbox
      .list(tab ? { connectionId: tab } : {})
      .then((next) => {
        if (live) setData(next);
      })
      .catch((cause) => {
        if (!live) return;
        // A removed account leaves its tab behind; fall back to All.
        if (tab) setTab(undefined);
        else setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [tab, reload, paused]);

  // `attempt` re-runs the sync for "Try again".
  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.inbox
      .refresh({})
      .catch((cause) => {
        if (live) setError(errorText(cause));
      })
      .then(() => {
        if (!live) return;
        setSynced(true);
        setReload((n) => n + 1);
        onRefreshed();
      });
    return () => {
      live = false;
    };
  }, [paused, attempt]);

  const groups = useMemo(() => groupInbox(data?.rows ?? [], new Date()), [data]);
  const accounts = data?.accounts ?? [];
  const failed = error || (data && data.failedAccounts.length > 0 ? errorText(undefined) : "");
  const loading = !data || (data.rows.length === 0 && !synced);
  const retry = () => {
    setError("");
    setAttempt((n) => n + 1);
    setReload((n) => n + 1);
  };
  const toggle = (id: string) => {
    const next = new URLSearchParams(params);
    if (openId === id) next.delete("mail");
    else next.set("mail", id);
    setParams(next);
  };

  return (
    <div className="rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-medium">
          <Trans>Inbox</Trans>
        </h1>
        {accounts.length > 1 ? (
          <Tabs
            value={tab ?? ALL}
            onValueChange={(value) => setTab(value === ALL ? undefined : value)}
          >
            <TabsList className="ms-auto max-w-full rounded-full">
              <TabsTrigger value={ALL} className="rounded-full px-3">
                <Trans>All</Trans>
              </TabsTrigger>
              {accounts.map((account) => (
                <TabsTrigger
                  key={account.connectionId}
                  value={account.connectionId}
                  className="max-w-40 rounded-full px-3"
                >
                  <span className="truncate">{account.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {failed ? (
        <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-destructive">
          <span>{failed}</span>
          <Button variant="outline" size="sm" onClick={retry}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : null}

      {data && accounts.length === 0 ? (
        <div className="grid place-items-center py-16">
          <Button onClick={onConnectMail}>
            <Trans>Connect mail</Trans>
          </Button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-9 w-full" />
          ))}
        </div>
      ) : data && data.rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          <Trans>No mail</Trans>
        </p>
      ) : (
        <>
          <InboxGroup
            title={<Trans>Needs reply</Trans>}
            rows={groups.needsReply}
            openId={openId}
            onToggle={toggle}
            today={false}
          />
          <InboxGroup
            title={<Trans>Today</Trans>}
            rows={groups.today}
            openId={openId}
            onToggle={toggle}
            today
          />
          <InboxGroup
            title={<Trans>Earlier</Trans>}
            rows={groups.earlier}
            openId={openId}
            onToggle={toggle}
            today={false}
          />
        </>
      )}
    </div>
  );
}

function InboxGroup({
  title,
  rows,
  openId,
  onToggle,
  today,
}: {
  title: React.ReactNode;
  rows: MailRow[];
  openId: string | null;
  onToggle: (id: string) => void;
  today: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-semibold text-muted-foreground">{title}</h2>
      {rows.map((row) => (
        <InboxRow
          key={row.id}
          row={row}
          open={openId === row.id}
          onToggle={() => onToggle(row.id)}
          today={today}
        />
      ))}
    </section>
  );
}

function InboxRow({
  row,
  open,
  onToggle,
  today,
}: {
  row: MailRow;
  open: boolean;
  onToggle: () => void;
  today: boolean;
}) {
  const bodyId = useId();
  return (
    <div className={open ? "rounded-lg bg-muted" : undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={onToggle}
        className="grid w-full grid-cols-[8px_1fr_auto] items-baseline gap-x-3 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-muted md:grid-cols-[8px_160px_1fr_auto]"
      >
        <span
          aria-hidden="true"
          className={`h-[7px] w-[7px] self-center rounded-full ${row.unread ? "bg-foreground" : "bg-transparent"}`}
        />
        <span dir="auto" className={`truncate ${row.unread ? "font-semibold" : ""}`}>
          {row.from}
          {row.unread ? (
            <span className="sr-only">
              <Trans> (unread)</Trans>
            </span>
          ) : null}
        </span>
        <span
          dir="auto"
          className="col-span-2 col-start-2 row-start-2 truncate md:col-span-1 md:col-start-auto md:row-start-auto"
        >
          {row.subject}
          {row.snippet ? <span className="text-muted-foreground"> — {row.snippet}</span> : null}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatMailTime(row.receivedAt, today)}
        </span>
      </button>
      {open ? <InboxMessageView id={bodyId} messageId={row.id} subject={row.subject} /> : null}
    </div>
  );
}

function InboxMessageView({
  id,
  messageId,
  subject,
}: {
  id: string;
  messageId: string;
  subject: string;
}) {
  const [message, setMessage] = useState<Awaited<ReturnType<typeof rpc.inbox.get>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setMessage(null);
    setError("");
    rpc.inbox
      .get({ messageId })
      .then((next) => {
        if (live) setMessage(next);
      })
      .catch((cause) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [messageId]);

  return (
    <div id={id} className="px-2.5 pb-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : !message ? (
        <Skeleton className="h-24 w-full" />
      ) : message.html ? (
        <div className="h-[min(70vh,640px)] overflow-hidden rounded-lg border border-border">
          <SandboxedHtmlViewer html={message.html} title={subject} scripts={false} />
        </div>
      ) : (
        <p dir="auto" className="whitespace-pre-wrap text-sm">
          {message.text}
        </p>
      )}
    </div>
  );
}
