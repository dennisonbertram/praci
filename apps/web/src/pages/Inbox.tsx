import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxListOutput, InboxTodo, MailRow } from "@rakazo/contracts";
import { InboxFilterSchema } from "@rakazo/contracts";
import { dueTone, groupInbox, localDaysUntil } from "@rakazo/core";
import {
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import {
  FileArchive,
  FileImage,
  FileText,
  ListFilter,
  PanelRightOpen,
  Search,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SandboxedHtmlViewer } from "../components/SandboxedHtmlViewer";
import { rpc, withSpaceHeaders } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const ALL = "all";
// ponytail: bounded polling while triage runs; add a user-level event if it often takes longer than 30 seconds.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 6;
const MAX_QUERY = 500;

type InboxFilter = (typeof InboxFilterSchema.options)[number];

/** Gmail's own labels for these filters. Search text goes to Gmail as typed. */
const filterLabels = (): Record<InboxFilter, string> => ({
  unread: t`Unread`,
  starred: t`Starred`,
  important: t`Important`,
  attachment: t`Has attachment`,
  primary: t`Primary`,
  promotions: t`Promotions`,
  social: t`Social`,
  updates: t`Updates`,
});

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
  onShowAgent,
  paused,
}: {
  onConnectMail: () => void;
  /** Called after a sync so the sidebar can refresh its unread count. */
  onRefreshed: () => void;
  /** Set while the Inbox agent panel is collapsed; shows the button that reopens it. */
  onShowAgent?: () => void;
  /** True while the Integrations overlay is open; the page reloads when it closes. */
  paused: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const openId = params.get("mail");
  const filterParam = InboxFilterSchema.safeParse(params.get("filter"));
  const filter = filterParam.success ? filterParam.data : undefined;
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY);
  const filtered = Boolean(filter || query);
  const [draft, setDraft] = useState(query);
  const [tab, setTab] = useState<string | undefined>();
  const [data, setData] = useState<InboxListOutput | null>(null);
  // Which request `data` answers, so a changed tab, filter or search shows loading, not old rows.
  const listKey = JSON.stringify([tab, filter, query]);
  const [dataKey, setDataKey] = useState("");
  const keyRef = useRef(listKey);
  keyRef.current = listKey;
  // Pages after the first of a filtered or searched list, which Gmail pages for us.
  const [more, setMore] = useState<{ rows: MailRow[]; token?: string; busy: boolean }>({
    rows: [],
    busy: false,
  });
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const polls = useRef(0);

  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.inbox
      .list({
        ...(tab ? { connectionId: tab } : {}),
        ...(filter ? { filter } : {}),
        ...(query ? { query } : {}),
      })
      .then((next) => {
        if (!live) return;
        setData(next);
        setDataKey(listKey);
        setMore({ rows: [], token: next.nextPageToken, busy: false });
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
  }, [tab, filter, query, reload, paused]);

  useEffect(() => setDraft(query), [query]);

  // Triage runs after the sync returns, so refetch a few times while the list reports it pending.
  useEffect(() => {
    if (paused || !data?.triagePending || polls.current >= TRIAGE_MAX_POLLS) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      setReload((n) => n + 1);
    }, TRIAGE_POLL_MS);
    return () => clearTimeout(timer);
  }, [data, paused]);

  // `attempt` re-runs the sync for "Try again".
  useEffect(() => {
    if (paused) return;
    polls.current = 0;
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

  const rows = useMemo(() => {
    if (!filtered) return data?.rows ?? [];
    // Needs reply belongs to the unfiltered view; a page loaded later can repeat a thread.
    const seen = new Set<string>();
    return [...(data?.rows ?? []), ...more.rows].flatMap((row) => {
      const thread = `${row.connectionId}:${row.threadId}`;
      if (seen.has(thread)) return [];
      seen.add(thread);
      return [{ ...row, needsReply: null }];
    });
  }, [data, more.rows, filtered]);
  const groups = useMemo(() => groupInbox(rows, new Date()), [rows]);
  const accounts = data?.accounts ?? [];
  const failed = error || (data && data.failedAccounts.length > 0 ? errorText(undefined) : "");
  const loading = !data || dataKey !== listKey || (!filtered && data.rows.length === 0 && !synced);
  const retry = () => {
    setError("");
    setAttempt((n) => n + 1);
    setReload((n) => n + 1);
  };
  const setParam = (name: "filter" | "q", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("mail");
    setParams(next);
  };
  const loadMore = () => {
    const key = listKey;
    setMore((m) => ({ ...m, busy: true }));
    rpc.inbox
      .list({
        ...(tab ? { connectionId: tab } : {}),
        ...(filter ? { filter } : {}),
        ...(query ? { query } : {}),
        ...(more.token ? { pageToken: more.token } : {}),
      })
      .then((page) => {
        if (keyRef.current !== key) return;
        setMore((m) => ({
          rows: [...m.rows, ...page.rows],
          token: page.nextPageToken,
          busy: false,
        }));
      })
      .catch((cause) => {
        if (keyRef.current !== key) return;
        setMore((m) => ({ ...m, busy: false }));
        setError(errorText(cause));
      });
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
        <div className="ms-auto flex min-w-0 items-center gap-2">
          {accounts.length > 1 ? (
            <Tabs
              value={tab ?? ALL}
              onValueChange={(value) => setTab(value === ALL ? undefined : value)}
            >
              <TabsList className="max-w-full rounded-full">
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
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setParam("q", draft.trim());
            }}
          >
            <InputGroup className="w-40 md:w-56">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                name="inbox-search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t`Search mail`}
                aria-label={t`Search mail`}
                maxLength={MAX_QUERY}
                className="[&::-webkit-search-cancel-button]:appearance-none"
                autoComplete="off"
              />
              {draft ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={t`Clear`}
                    onClick={() => {
                      setDraft("");
                      setParam("q", "");
                    }}
                  >
                    <X aria-hidden="true" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="inbox-filter"
              render={<Button variant={filter ? "secondary" : "outline"} size="sm" />}
              aria-label={filter ? undefined : t`Filter`}
            >
              <ListFilter aria-hidden="true" />
              {filter ? filterLabels()[filter] : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={filter ?? ""}
                onValueChange={(value) => setParam("filter", String(value))}
              >
                {(["unread", "starred", "important", "attachment"] as const).map((name) => (
                  <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                    {filterLabels()[name]}
                  </DropdownMenuRadioItem>
                ))}
                <DropdownMenuSeparator />
                {(["primary", "promotions", "social", "updates"] as const).map((name) => (
                  <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                    {filterLabels()[name]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              {filter ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setParam("filter", "")}>
                    <Trans>Clear</Trans>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {onShowAgent ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Show Inbox agent`}
              onClick={onShowAgent}
            >
              <PanelRightOpen aria-hidden="true" />
            </Button>
          ) : null}
        </div>
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
        failed ? null : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            <Trans>No mail</Trans>
          </p>
        )
      ) : (
        <>
          {filtered ? null : <TodoCard connectionId={tab} list={data} paused={paused} />}
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
          {filtered && more.token ? (
            <div className="grid place-items-center pb-2">
              <Button variant="outline" size="sm" disabled={more.busy} onClick={loadMore}>
                <Trans>Load more</Trans>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The open to-dos triage keeps; hidden while triage is off or there is nothing to do. */
function TodoCard({
  connectionId,
  list,
  paused,
}: {
  connectionId: string | undefined;
  /** Each new list response refetches the to-dos, so they are never older than the list's triage state. */
  list: InboxListOutput;
  paused: boolean;
}) {
  const { t, i18n: lingui } = useLingui();
  const [todos, setTodos] = useState<InboxTodo[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (paused) return;
    if (!list.enabled) {
      setTodos([]);
      return;
    }
    let live = true;
    rpc.inbox.todos
      .list(connectionId ? { connectionId } : {})
      .then((next) => {
        if (live) setTodos(next.todos);
      })
      .catch(() => {
        // The inbox list above already reports a failed load; the card just stays hidden.
        if (live) setTodos([]);
      });
    return () => {
      live = false;
    };
  }, [connectionId, list, paused]);

  if (todos.length === 0) return null;
  const now = new Date();
  const ordered = [...todos].sort((a, b) => Number(a.doneAt !== null) - Number(b.doneAt !== null));
  const dueLabel = (dueOn: string, days: number) => {
    if (days === 0) return t`Today`;
    const [year = 0, month = 1, day = 1] = dueOn.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(
      lingui.locale || "en",
      days > 0 && days <= 6 ? { weekday: "short" } : { month: "short", day: "numeric" },
    );
  };
  const setDone = (todo: InboxTodo, done: boolean) => {
    setError("");
    rpc.inbox.todos
      .setDone({ id: todo.id, done })
      .then((next) => setTodos((list) => list.map((item) => (item.id === next.id ? next : item))))
      .catch((cause) => setError(errorText(cause)));
  };

  return (
    <Card
      size="sm"
      role="region"
      className="mb-5 gap-1 px-3.5"
      aria-labelledby="inbox-todo-heading"
    >
      <h2 id="inbox-todo-heading" className="mb-1 text-xs font-semibold text-muted-foreground">
        <Trans>To do</Trans>
      </h2>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul>
        {ordered.map((todo) => {
          const days = todo.dueOn ? localDaysUntil(todo.dueOn, now) : null;
          const tone = dueTone(days, todo.priority);
          const done = todo.doneAt !== null;
          return (
            <li
              key={todo.id}
              className="flex items-start gap-2.5 border-t border-border py-1.5 first:border-t-0"
            >
              <Checkbox
                aria-label={todo.text}
                checked={done}
                onCheckedChange={(checked) => setDone(todo, checked)}
                className="mt-0.5"
              />
              <div
                dir="auto"
                className={`min-w-0 flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}
              >
                {todo.text}
                {todo.from || todo.detail ? (
                  <small className="block truncate text-xs text-muted-foreground">
                    {[todo.from, todo.detail].filter(Boolean).join(" · ")}
                  </small>
                ) : null}
              </div>
              {todo.dueOn && days !== null ? (
                <span
                  className={`whitespace-nowrap text-xs ${tone === "crit" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-muted-foreground"}`}
                >
                  {dueLabel(todo.dueOn, days)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
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
          <SandboxedHtmlViewer html={message.html} title={subject} email />
        </div>
      ) : (
        <p dir="auto" className="whitespace-pre-wrap text-sm">
          {message.text}
        </p>
      )}
      {message?.attachments.length ? (
        <InboxAttachments messageId={messageId} attachments={message.attachments} />
      ) : null}
    </div>
  );
}

type MailAttachmentItem = Awaited<ReturnType<typeof rpc.inbox.get>>["attachments"][number];

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage />;
  if (/zip|compressed|tar/.test(mimeType)) return <FileArchive />;
  return <FileText />;
}

function formatAttachmentSize(bytes: number): string {
  const [unit, divisor] =
    bytes < 1_000
      ? (["byte", 1] as const)
      : bytes < 1_000_000
        ? (["kilobyte", 1_000] as const)
        : (["megabyte", 1_000_000] as const);
  return new Intl.NumberFormat(i18n.locale || "en", {
    style: "unit",
    unit,
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}

/** Fetches with the session and space header, then saves the bytes; the file is never opened in the page. */
async function saveAttachment(messageId: string, attachment: MailAttachmentItem) {
  const response = await fetch(
    `/api/inbox/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`,
    { headers: withSpaceHeaders(), credentials: "include" },
  );
  if (!response.ok) throw new Error(`Attachment download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function InboxAttachments({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: MailAttachmentItem[];
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-3">
      <ul aria-label={t`Attachments`} className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFailed(false);
                saveAttachment(messageId, attachment).catch(() => setFailed(true));
              }}
            >
              <AttachmentIcon mimeType={attachment.mimeType} />
              <span className="max-w-56 truncate">{attachment.filename}</span>
              <span className="text-muted-foreground">{formatAttachmentSize(attachment.size)}</span>
            </Button>
          </li>
        ))}
      </ul>
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          <Trans>Download failed</Trans>
        </p>
      ) : null}
    </div>
  );
}
