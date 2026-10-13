import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxListOutput, InboxMark, InboxTodo, MailRow } from "@rakazo/contracts";
import { InboxFilterSchema, InboxViewCategorySchema } from "@rakazo/contracts";
import { groupInbox } from "@rakazo/core";
import {
  Button,
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
  Toggle,
} from "@rakazo/ui-web";
import { ListFilter, PanelRightOpen, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { InboxConsentPrompt } from "../components/AiDataSharing";
import { ComposeEmail, MAIL_SENT_EVENT, NEW_MESSAGE } from "../components/ComposeEmail";
import { InboxMessageDialog } from "../components/inbox/InboxMessageDialog";
import { InboxGroup } from "../components/inbox/InboxRow";
import { InboxShortcuts } from "../components/inbox/InboxShortcuts";
import { TodoCard } from "../components/inbox/TodoCard";
import { useInboxKeyboard } from "../lib/inbox-keyboard";
import {
  inboxListInput,
  MAX_QUERY,
  readInboxListState,
  setInboxListParam,
} from "../lib/inbox-list-input";
import { prefetchInboxMessage } from "../lib/inbox-message-cache";
import { syncErrorText } from "../lib/inbox-sync-error";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const ALL = "all";
// ponytail: bounded polling while triage runs; add a user-level event if it often takes longer than 30 seconds.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 6;
const STATUS_MS = 6_000;
/** Marks the `?mail=` history entry the list pushed, so closing the message can go Back. */
const LIST_OPEN = { inboxList: true };

type Status = { kind: "sent" } | { kind: "marked"; messageId: string; mark: InboxMark };

type InboxFilter = (typeof InboxFilterSchema.options)[number];
type InboxViewCategory = (typeof InboxViewCategorySchema.options)[number];

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

/** Triage categories the filter menu offers, narrowing the cached list. */
const categoryLabels = (): Record<InboxViewCategory, string> => ({
  billing: t`Bills`,
  receipt: t`Receipts`,
  scheduling: t`Scheduling`,
  newsletter: t`Newsletters`,
  security: t`Security`,
  notification: t`Notifications`,
  personal: t`Personal`,
});

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
  const location = useLocation();
  const navigate = useNavigate();
  const openId = params.get("mail");
  const listState = readInboxListState(params);
  const { filter, query, view, category } = listState;
  const filtered = Boolean(filter || query);
  const [draft, setDraft] = useState(query);
  const [tab, setTab] = useState<string | undefined>();
  const [data, setData] = useState<InboxListOutput | null>(null);
  // Which request `data` answers, so a changed tab, filter or search shows loading, not old rows.
  const listKey = JSON.stringify([tab, filter, query, view, category]);
  const [dataKey, setDataKey] = useState("");
  // Lists already fetched this session, shown at once while their key is refetched.
  const cache = useRef(new Map<string, InboxListOutput>());
  const keyRef = useRef(listKey);
  keyRef.current = listKey;
  // Pages after the first of a filtered or searched list, which Gmail pages for us.
  const [more, setMore] = useState<{ rows: MailRow[]; token?: string; busy: boolean }>({
    rows: [],
    busy: false,
  });
  const [error, setError] = useState("");
  // Shown briefly at the bottom; a mark stays undoable even after its row left the list.
  const [status, setStatus] = useState<Status | null>(null);
  const [todosByTab, setTodosByTab] = useState<Record<string, InboxTodo[]>>({});
  const [todoRefresh, setTodoRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const [synced, setSynced] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const polls = useRef(0);
  const [composing, setComposing] = useState(false);

  // A message sent from any composer: say so and reload, since the send synced the account.
  useEffect(() => {
    const onSent = () => {
      setStatus({ kind: "sent" });
      setReload((n) => n + 1);
      onRefreshed();
    };
    window.addEventListener(MAIL_SENT_EVENT, onSent);
    return () => window.removeEventListener(MAIL_SENT_EVENT, onSent);
  }, [onRefreshed]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.inbox
      .list(inboxListInput(listState, tab))
      .then((next) => {
        if (!live) return;
        cache.current.set(listKey, next);
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
  }, [tab, filter, query, view, category, reload, paused]);

  useEffect(() => setDraft(query), [query]);

  // To-dos load beside the list, so the card never pushes loaded rows down.
  const tabKey = tab ?? ALL;
  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.inbox.todos
      .list(tab ? { connectionId: tab } : {})
      .then((next) => live && setTodosByTab((all) => ({ ...all, [tabKey]: next.todos })))
      // The list reports its own failure; the card just stays hidden.
      .catch(() => live && setTodosByTab((all) => ({ ...all, [tabKey]: [] })));
    return () => {
      live = false;
    };
  }, [tab, tabKey, todoRefresh, paused]);
  // Refetch when a sync lands, triage finishes, or triage turns on or off (consent, model),
  // not on every reload or poll.
  const syncedAt = data?.syncedAt;
  const pending = data?.triagePending;
  const triageState = `${data?.enabled}:${data?.triageBlocked?.reason ?? ""}`;
  const seen = useRef<{ syncedAt: unknown; pending: unknown; triageState: string } | null>(null);
  useEffect(() => {
    if (!data) return;
    const before = seen.current;
    seen.current = { syncedAt, pending, triageState };
    if (
      before &&
      (before.syncedAt !== syncedAt ||
        before.triageState !== triageState ||
        (before.pending && !pending))
    ) {
      setTodoRefresh((n) => n + 1);
    }
  }, [data, syncedAt, pending, triageState]);

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

  // This key's answer, or its cached one while the fresh one loads; never another key's rows.
  const fresh = dataKey === listKey;
  const shown = fresh ? data : (cache.current.get(listKey) ?? null);
  const moreRows = fresh ? more.rows : [];
  const rows = useMemo(() => {
    if (!filtered) return shown?.rows ?? [];
    // Needs reply belongs to the unfiltered view; a page loaded later can repeat a thread.
    const seen = new Set<string>();
    return [...(shown?.rows ?? []), ...moreRows].flatMap((row) => {
      const thread = `${row.connectionId}:${row.threadId}`;
      if (seen.has(thread)) return [];
      seen.add(thread);
      return [{ ...row, needsReply: null }];
    });
  }, [shown, moreRows, filtered]);
  const groups = useMemo(() => groupInbox(rows, new Date()), [rows]);
  const ids = useMemo(
    () => [...groups.needsReply, ...groups.today, ...groups.earlier].map((row) => row.id),
    [groups],
  );
  const accounts = data?.accounts ?? [];
  const failed = error || (shown ? syncErrorText(shown) : "");
  const todos = todosByTab[tabKey];
  const retry = () => {
    setError("");
    setAttempt((n) => n + 1);
    setReload((n) => n + 1);
  };
  const setParam = (name: Parameters<typeof setInboxListParam>[1], value: string) =>
    setParams(setInboxListParam(params, name, value));
  // The view and category buttons show only when triage can fill them in.
  const triage = Boolean(shown?.enabled);
  const narrowed = triage && (view === "important" || Boolean(category));
  const showTodos =
    triage && !filtered && !narrowed && shown?.triageBlocked?.reason !== "needs_consent";
  const loading =
    !shown ||
    (!filtered && shown.rows.length === 0 && !synced) ||
    (showTodos && todos === undefined);
  const patchFeedback = (messageId: string, feedback: InboxMark | null) => {
    const patchRows = (list: MailRow[]) =>
      list.map((row) => (row.id === messageId ? { ...row, feedback } : row));
    const patch = (list: InboxListOutput) => ({ ...list, rows: patchRows(list.rows) });
    setData((list) => list && patch(list));
    setMore((m) => ({ ...m, rows: patchRows(m.rows) }));
    for (const [key, list] of cache.current) cache.current.set(key, patch(list));
  };
  // The row changes at once; a failed save puts it back.
  const mark = (messageId: string, value: InboxMark | null) => {
    const before = rows.find((row) => row.id === messageId)?.feedback ?? null;
    setError("");
    patchFeedback(messageId, value);
    setStatus(value ? { kind: "marked", messageId, mark: value } : null);
    rpc.inbox
      .feedback({ messageId, mark: value })
      .then(() => setReload((n) => n + 1))
      .catch((cause) => {
        patchFeedback(messageId, before);
        setStatus(null);
        setError(errorText(cause));
      });
  };
  const loadMore = () => {
    const key = listKey;
    setMore((m) => ({ ...m, busy: true }));
    rpc.inbox
      .list(inboxListInput(listState, tab, more.token))
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
  // `?mail=` is the source of truth for the open message, so Back and deep links work.
  // A list-opened message pushes an entry marked with LIST_OPEN, and closing goes Back to it.
  const openMessage = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("mail", id);
    setSelectedId(id);
    setParams(next, { state: LIST_OPEN });
  };
  const closeMessage = () => {
    if ((location.state as typeof LIST_OPEN | null)?.inboxList) return navigate(-1);
    const next = new URLSearchParams(params);
    next.delete("mail");
    setParams(next, { replace: true });
  };
  const goToMessage = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("mail", id);
    setSelectedId(id);
    setParams(next, { replace: true, state: location.state });
  };
  const openRow = [...(shown?.rows ?? []), ...moreRows].find((row) => row.id === openId);
  const openIndex = openId ? ids.indexOf(openId) : -1;
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    for (const name of ["filter", "category", "view", "mail"]) next.delete(name);
    setParams(next);
  };

  useInboxKeyboard({
    ids,
    selectedId,
    enabled: !paused && !openId && !composing && !help,
    select: setSelectedId,
    open: openMessage,
    focusSearch: () => searchRef.current?.querySelector("input")?.focus(),
    compose: accounts.length > 0 ? () => setComposing(true) : undefined,
    help: () => setHelp(true),
  });
  // Warm the cache so the first messages and the selected one open instantly.
  useEffect(() => {
    for (const id of ids.slice(0, 3)) prefetchInboxMessage(id);
  }, [ids]);
  useEffect(() => {
    if (selectedId) prefetchInboxMessage(selectedId);
  }, [selectedId]);
  // Back from a message lands on its row.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (openId) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      requestAnimationFrame(() =>
        [...document.querySelectorAll<HTMLElement>("[data-row-id]")]
          .find((el) => el.dataset.rowId === selectedId)
          ?.focus(),
      );
    }
  }, [openId, selectedId]);

  return (
    <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 @md:flex-nowrap">
        <h1 className="me-auto shrink-0 text-lg font-medium @md:me-1">
          <Trans>Inbox</Trans>
        </h1>
        <form
          ref={searchRef}
          className="order-last min-w-0 basis-full @md:order-none @md:flex-1 @md:basis-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setParam("q", draft.trim());
          }}
        >
          <InputGroup className="w-full max-w-sm">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="inbox-search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                setDraft("");
                if (query) setParam("q", "");
              }}
              placeholder={t`Search mail`}
              aria-label={t`Search mail`}
              maxLength={MAX_QUERY}
              className="min-w-0 [&::-webkit-search-cancel-button]:appearance-none"
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
                    searchRef.current?.querySelector("input")?.focus();
                  }}
                >
                  <X aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </form>
        {triage ? (
          <Toggle
            variant="outline"
            size="sm"
            className="pointer-coarse:h-10 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
            pressed={view === "important"}
            onPressedChange={(pressed) => setParam("view", pressed ? "important" : "")}
          >
            <Trans>Important</Trans>
          </Toggle>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="inbox-filter"
            render={
              <Button
                variant={filter || (triage && category) ? "secondary" : "outline"}
                size="sm"
                className="pointer-coarse:h-10 pointer-coarse:min-w-10"
              />
            }
            aria-label={filter || (triage && category) ? undefined : t`Filter`}
          >
            <ListFilter aria-hidden="true" />
            {filter
              ? filterLabels()[filter]
              : triage && category
                ? categoryLabels()[category]
                : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={filter ?? (triage ? category : undefined) ?? ""}
              onValueChange={(value) => {
                const named = InboxFilterSchema.safeParse(value);
                setParam(named.success ? "filter" : "category", String(value));
              }}
            >
              {(triage
                ? (["unread", "starred", "attachment"] as const)
                : (["unread", "starred", "important", "attachment"] as const)
              ).map((name) => (
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
              {triage ? (
                <>
                  <DropdownMenuSeparator />
                  {InboxViewCategorySchema.options.map((name) => (
                    <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                      {categoryLabels()[name]}
                    </DropdownMenuRadioItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuRadioGroup>
            {filter || (triage && category) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setParam(filter ? "filter" : "category", "")}>
                  <Trans>Clear</Trans>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="icon-sm"
          className="pointer-coarse:size-10"
          aria-label={t`Compose`}
          disabled={accounts.length === 0}
          onClick={() => setComposing(true)}
        >
          <SquarePen aria-hidden="true" />
        </Button>
        {onShowAgent ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-10"
            aria-label={t`Show Inbox agent`}
            onClick={onShowAgent}
          >
            <PanelRightOpen aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {accounts.length > 1 ? (
        <Tabs
          className="-mt-2 mb-4"
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
      ) : shown && shown.rows.length === 0 ? (
        failed ? null : (
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
            {query ? (
              <>
                <p>
                  <Trans>No results for "{query}"</Trans>
                </p>
                <Button variant="outline" size="sm" onClick={() => setParam("q", "")}>
                  <Trans>Clear search</Trans>
                </Button>
              </>
            ) : filter || category || view === "important" ? (
              <>
                <p>
                  <Trans>No mail matches this filter</Trans>
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <Trans>Clear filter</Trans>
                </Button>
              </>
            ) : (
              <p>
                <Trans>No mail</Trans>
              </p>
            )}
          </div>
        )
      ) : shown ? (
        <>
          {filtered || narrowed ? null : shown.triageBlocked?.reason === "needs_consent" ? (
            // Allowing syncs again, which is what queues triage now that it may run.
            <InboxConsentPrompt
              recipient={shown.triageBlocked.recipient}
              onAllowed={() => {
                setAttempt((n) => n + 1);
                setReload((n) => n + 1);
              }}
            />
          ) : showTodos && todos ? (
            <TodoCard
              todos={todos}
              onChange={(next) =>
                setTodosByTab((all) => ({
                  ...all,
                  [tabKey]: (all[tabKey] ?? []).map((item) => (item.id === next.id ? next : item)),
                }))
              }
            />
          ) : null}
          <InboxGroup
            title={<Trans>Needs reply</Trans>}
            hideAttention
            rows={groups.needsReply}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
            selectedId={selectedId}
            today={false}
          />
          <InboxGroup
            title={<Trans>Today</Trans>}
            rows={groups.today}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
            selectedId={selectedId}
            today
          />
          <InboxGroup
            title={<Trans>Earlier</Trans>}
            rows={groups.earlier}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
            selectedId={selectedId}
            today={false}
          />
          {filtered && fresh && more.token ? (
            <div className="grid place-items-center pb-2">
              <Button variant="outline" size="sm" disabled={more.busy} onClick={loadMore}>
                <Trans>Load more</Trans>
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <InboxMessageDialog
        messageId={openId}
        subject={openRow?.subject}
        onClose={closeMessage}
        previousId={openIndex > 0 ? ids[openIndex - 1] : undefined}
        nextId={openIndex >= 0 ? ids[openIndex + 1] : undefined}
        onNavigate={goToMessage}
      />
      <InboxShortcuts open={help} onClose={() => setHelp(false)} />
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex justify-center px-4"
      >
        {status ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card py-1 ps-3 pe-1 text-sm text-card-foreground shadow-md">
            {status.kind === "sent" ? (
              <Trans>Sent</Trans>
            ) : status.mark === "noise" ? (
              <Trans>Marked noise</Trans>
            ) : (
              <Trans>Marked important</Trans>
            )}
            {status.kind === "marked" ? (
              <Button variant="ghost" size="sm" onClick={() => mark(status.messageId, null)}>
                <Trans>Undo</Trans>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {composing ? (
        <ComposeEmail
          seed={NEW_MESSAGE}
          accounts={accounts}
          connectionId={tab}
          onClose={() => setComposing(false)}
        />
      ) : null}
    </div>
  );
}
