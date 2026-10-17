import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxListOutput, InboxMark, InboxTodo, MailRow } from "@rakazo/contracts";
import { InboxFilterSchema, InboxViewCategorySchema } from "@rakazo/contracts";
import { groupInbox } from "@rakazo/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Skeleton,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  Toggle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { ListFilter, Mail, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { InboxConsentPrompt } from "../components/AiDataSharing";
import { AskBotButton } from "../components/AskBotButton";
import { ComposeEmail, NEW_MESSAGE } from "../components/ComposeEmail";
import { InboxMessageDialog } from "../components/inbox/InboxMessageDialog";
import { InboxGroup } from "../components/inbox/InboxRow";
import { InboxShortcuts } from "../components/inbox/InboxShortcuts";
import { TodoCard } from "../components/inbox/TodoCard";
import { PageEmptyState } from "../components/PageEmptyState";
import { maskCurrencyWhenHidden } from "../lib/hide-amounts-preference";
import { useInboxKeyboard } from "../lib/inbox-keyboard";
import {
  inboxListInput,
  MAX_QUERY,
  readInboxListState,
  setInboxListParam,
} from "../lib/inbox-list-input";
import { INBOX_CHANGED_EVENT, prefetchInboxMessage } from "../lib/inbox-message-cache";
import { syncErrorText } from "../lib/inbox-sync-error";
import { MAIL_SENT_EVENT } from "../lib/outbox";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const ALL = "all";
// ponytail: bounded polling while triage runs; add a user-level event if it often takes longer than 30 seconds.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 12;
// ponytail: an open Inbox looks for new mail once a minute (the server syncs at most that often);
// switch to a pushed event if the delay matters.
const NEW_MAIL_POLL_MS = 60_000;
// Long enough to read the toast and reach its Undo.
const STATUS_MS = 10_000;
const PREFETCH_DELAY_MS = 250;
/** Marks the `?mail=` history entry the list pushed, so closing the message can go Back. */
const LIST_OPEN = { inboxList: true };

/** The account tab last chosen in this window; a removed account falls back to All. */
let rememberedTab: string | undefined;

type Status =
  | { kind: "marked"; messageId: string; mark: InboxMark; sender: string }
  | { kind: "archived"; messageId: string; subject: string };

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
  spaceName,
}: {
  onConnectMail: () => void;
  /** The space's name, when the user has more than one, so they know whose mail this is. */
  spaceName?: string;
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
  // Kept while the app is open, so leaving the Inbox and coming back keeps the chosen account.
  const [tab, setTab] = useState<string | undefined>(() => rememberedTab);
  useEffect(() => {
    rememberedTab = tab;
  }, [tab]);
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
  // Spoken by screen readers only, for read changes; the Archived toast is already a status region.
  const [announcement, setAnnouncement] = useState("");
  const announceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [todosByTab, setTodosByTab] = useState<Record<string, InboxTodo[]>>({});
  const [todoRefresh, setTodoRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const [synced, setSynced] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const polls = useRef(0);
  // Triage still pending after the last poll: say so and offer a retry instead of spinning.
  const [stalled, setStalled] = useState(false);
  const archiving = useRef(new Map<string, Promise<boolean>>());
  const [composing, setComposing] = useState(false);
  // The first sort after Allow: rows keep their places until triage finishes, then regroup once.
  const [sorting, setSorting] = useState(false);
  const sortingRef = useRef(false);
  sortingRef.current = sorting;
  // Triage finished during the first sort, and the to-dos it made are still loading.
  const sortEnding = useRef(false);
  // "Not now" on the sorting prompt hides it for this visit only.
  const [consentDismissed, setConsentDismissed] = useState(false);

  // A message sent from any composer: reload, since the send synced the account.
  useEffect(() => {
    const onSent = () => {
      setReload((n) => n + 1);
      onRefreshed();
    };
    window.addEventListener(MAIL_SENT_EVENT, onSent);
    // An agent card archived or marked a message: the list shows it at once.
    window.addEventListener(INBOX_CHANGED_EVENT, onSent);
    return () => {
      window.removeEventListener(MAIL_SENT_EVENT, onSent);
      window.removeEventListener(INBOX_CHANGED_EVENT, onSent);
    };
  }, [onRefreshed]);

  // New mail shows up, and the sidebar count follows, while the page stays open.
  useEffect(() => {
    if (paused) return;
    // The same sync as opening the page: it fetches new mail, then the list and the count reload.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setAttempt((n) => n + 1);
    }, NEW_MAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [paused]);

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
    const done = (todos: InboxTodo[]) => {
      if (!live) return;
      setTodosByTab((all) => ({ ...all, [tabKey]: todos }));
      if (sortEnding.current) {
        sortEnding.current = false;
        setSorting(false);
      }
    };
    rpc.inbox.todos
      .list(tab ? { connectionId: tab } : {})
      .then((next) => done(next.todos))
      // The list reports its own failure; the card just stays hidden.
      .catch(() => done([]));
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
      if (before.pending && !pending && sortingRef.current) sortEnding.current = true;
      setTodoRefresh((n) => n + 1);
    }
  }, [data, syncedAt, pending, triageState]);

  // Triage runs after the sync returns, so refetch a few times while the list reports it pending.
  useEffect(() => {
    if (paused || !data?.triagePending) return;
    if (polls.current >= TRIAGE_MAX_POLLS) {
      setStalled(true);
      return;
    }
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
    setStalled(false);
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
  // The view and category buttons show only when triage can fill them in.
  const triage = Boolean(shown?.enabled ?? data?.enabled);
  const firstSort =
    triage &&
    Boolean(shown?.triagePending) &&
    (shown?.rows.length ?? 0) > 0 &&
    shown?.rows.every((row) => row.needsReply === null);
  useEffect(() => {
    if (firstSort) setSorting(true);
    // The to-dos reload when triage finishes; sorting ends when they arrive, so the page changes once.
    else if (!shown?.triagePending && !sortEnding.current) setSorting(false);
  }, [firstSort, shown?.triagePending]);
  const narrowed = triage && (view === "important" || Boolean(category));
  // A search or narrowed list is one date-ordered list under a result count, not Needs reply / Today / Earlier.
  const resultsView = filtered || narrowed;
  const groups = useMemo(
    () =>
      groupInbox(
        sorting
          ? // Rows sorted so far show nothing new until the whole sort lands.
            rows.map((row) => ({
              ...row,
              needsReply: null,
              priority: null,
              reason: null,
              category: null,
            }))
          : resultsView
            ? rows.map((row) => ({ ...row, needsReply: null }))
            : rows,
        new Date(),
      ),
    [rows, resultsView, sorting],
  );
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
  const showTodos =
    triage &&
    !sorting &&
    !filtered &&
    !narrowed &&
    shown?.triageBlocked?.reason !== "needs_consent";
  const loading =
    !shown ||
    (!filtered && shown.rows.length === 0 && !synced) ||
    (showTodos && todos === undefined && !sorting);
  // Applies a change to every copy of the rows: the list, the pages after it and the cached lists.
  const patchRows = (change: (rows: MailRow[]) => MailRow[]) => {
    const patch = (list: InboxListOutput) => ({ ...list, rows: change(list.rows) });
    setData((list) => list && patch(list));
    setMore((m) => ({ ...m, rows: change(m.rows) }));
    for (const [key, list] of cache.current) cache.current.set(key, patch(list));
  };
  const patchFeedback = (messageId: string, feedback: InboxMark | null) =>
    patchRows((list) => list.map((row) => (row.id === messageId ? { ...row, feedback } : row)));
  // The row changes at once; a failed change shows the error and reloads the real list.
  const change = (call: Promise<unknown>) => {
    setError("");
    call.then(onRefreshed).catch((cause) => {
      setError(errorText(cause));
      setReload((n) => n + 1);
    });
  };
  const setRead = (messageId: string, read: boolean) => {
    // Clear first so a repeat of the same message is announced again.
    setAnnouncement("");
    const text = read ? t`Marked read` : t`Marked unread`;
    clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setAnnouncement(text), 50);
    patchRows((list) =>
      list.map((row) => (row.id === messageId ? { ...row, unread: !read } : row)),
    );
    change(rpc.inbox.markRead({ messageId, read }));
  };
  const archive = (messageId: string) => {
    // The selection and the open message move on to a neighbor before the row goes.
    const index = ids.indexOf(messageId);
    const neighbor = ids[index + 1] ?? ids[index - 1];
    if (selectedId === messageId) setSelectedId(neighbor);
    const subject = rows.find((row) => row.id === messageId)?.subject ?? "";
    patchRows((list) => list.filter((row) => row.id !== messageId));
    setStatus({ kind: "archived", messageId, subject });
    const call = rpc.inbox.archive({ messageId });
    // Resolves to whether the archive saved, so Undo never overtakes it.
    archiving.current.set(
      messageId,
      call.then(
        () => true,
        () => false,
      ),
    );
    change(call);
    return neighbor;
  };
  const unarchive = async (messageId: string) => {
    setStatus(null);
    const saved = await archiving.current.get(messageId);
    archiving.current.delete(messageId);
    // A failed archive already showed its error and reloaded the list.
    if (saved === false) return;
    setError("");
    rpc.inbox
      .unarchive({ messageId })
      .then(onRefreshed)
      .catch((cause) => setError(errorText(cause)))
      .then(() => setReload((n) => n + 1));
  };
  // The row changes at once; a failed save puts it back.
  const mark = (messageId: string, value: InboxMark | null) => {
    const row = rows.find((item) => item.id === messageId);
    const before = row?.feedback ?? null;
    setError("");
    patchFeedback(messageId, value);
    setStatus(value ? { kind: "marked", messageId, mark: value, sender: row?.from ?? "" } : null);
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
  // A message that stays open for 800ms is read once. Passing through it with j/k, or selecting in
  // the list, does not. The id is remembered even when the row is already read, so Mark unread sticks.
  const readFor = useRef<string | null>(null);
  const setReadRef = useRef(setRead);
  setReadRef.current = setRead;
  const openUnread = openRow?.unread;
  const openRowId = openRow?.id;
  useEffect(() => {
    if (!openId) {
      readFor.current = null;
      return;
    }
    if (!openRowId || readFor.current === openId) return;
    const timer = setTimeout(() => {
      readFor.current = openId;
      if (openUnread) setReadRef.current(openId, true);
    }, 800);
    return () => clearTimeout(timer);
  }, [openId, openRowId, openUnread]);
  const openIndex = openId ? ids.indexOf(openId) : -1;
  const focusSearch = () => searchRef.current?.querySelector("input")?.focus();
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    for (const name of ["q", "filter", "category", "view", "mail"]) next.delete(name);
    setParams(next);
  };

  useInboxKeyboard({
    ids,
    selectedId,
    enabled: !paused && !openId && !composing && !help,
    select: setSelectedId,
    open: openMessage,
    focusSearch,
    compose: accounts.length > 0 ? () => setComposing(true) : undefined,
    archive: (id) => {
      if (rows.find((row) => row.id === id)?.inInbox) archive(id);
    },
    help: () => setHelp(true),
  });
  // "?" also works with a message open, where the list's keys are off.
  useEffect(() => {
    if (paused || !openId || composing || help) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")
      )
        return;
      event.preventDefault();
      setHelp(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, openId, composing, help]);
  // Warm the cache so the first messages and the selected one open instantly.
  useEffect(() => {
    for (const id of ids.slice(0, 3)) prefetchInboxMessage(id);
  }, [ids]);
  // Debounced so holding j or k does not fetch every row passed over.
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => prefetchInboxMessage(selectedId), PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
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

  const toast = status ? (
    <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-lg bg-primary py-1 ps-3 pe-1 text-sm text-primary-foreground shadow-lg">
      {status.kind === "archived" ? (
        <span className="min-w-0 truncate" dir="auto">
          {status.subject ? (
            <Trans>Archived "{maskCurrencyWhenHidden(status.subject)}"</Trans>
          ) : (
            <Trans>Archived</Trans>
          )}
        </span>
      ) : status.mark === "noise" ? (
        <Trans>Mail from {status.sender} is now marked as noise</Trans>
      ) : (
        <Trans>Mail from {status.sender} is now marked important</Trans>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          status.kind === "archived" ? unarchive(status.messageId) : mark(status.messageId, null)
        }
      >
        <Trans>Undo</Trans>
      </Button>
    </div>
  ) : null;

  return (
    <div
      data-inbox-page
      className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-6 xl:px-10"
    >
      <div className="mb-5 flex flex-wrap items-center gap-2 @md:flex-nowrap">
        <div className="me-auto flex min-w-0 shrink-0 flex-col @md:me-1">
          <h1 className="text-lg font-semibold">
            <Trans>Inbox</Trans>
          </h1>
          {spaceName ? (
            <span className="max-w-48 truncate text-xs text-muted-foreground">{spaceName}</span>
          ) : null}
        </div>
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
              placeholder={t`Search mail, e.g. from:sam has:attachment`}
              aria-label={t`Search mail`}
              // Nothing to search or filter before mail is connected.
              disabled={Boolean(data) && accounts.length === 0}
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
            disabled={Boolean(data) && accounts.length === 0}
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
          <DropdownMenuContent align="end" className="min-w-48">
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
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <Trans>Gmail tabs</Trans>
                </DropdownMenuLabel>
                {(["primary", "promotions", "social", "updates"] as const).map((name) => (
                  <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                    {filterLabels()[name]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
              {triage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <Trans>Categories</Trans>
                    </DropdownMenuLabel>
                    {InboxViewCategorySchema.options.map((name) => (
                      <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                        {categoryLabels()[name]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuGroup>
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="pointer-coarse:size-10"
                aria-label={t`Compose`}
                disabled={accounts.length === 0}
                onClick={() => setComposing(true)}
              />
            }
          >
            <SquarePen aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>{t`Compose`}</TooltipContent>
        </Tooltip>
        {onShowAgent ? <AskBotButton botName="Inbox agent" onClick={onShowAgent} /> : null}
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
          {/* A lapsed sign-in is fixed by signing in again; trying again would fail the same way. */}
          {!error && shown?.reconnectAccounts.length ? (
            <Button variant="outline" size="sm" onClick={onConnectMail}>
              <Trans>Reconnect Gmail</Trans>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={retry}>
              <Trans>Try again</Trans>
            </Button>
          )}
        </div>
      ) : null}

      {data && accounts.length === 0 ? (
        <PageEmptyState
          icon={<Mail className="size-8" strokeWidth={1.6} aria-hidden="true" />}
          title={<Trans>No mail connected</Trans>}
          description={<Trans>Connect Gmail to read, sort and answer your mail here.</Trans>}
        >
          <Button onClick={onConnectMail}>
            <Trans>Connect mail</Trans>
          </Button>
        </PageEmptyState>
      ) : loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-9 w-full" />
          ))}
        </div>
      ) : shown && rows.length === 0 ? (
        failed ? null : (
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
            {query ? (
              <>
                <p>
                  <Trans>No results for "{query}"</Trans>
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <Trans>Clear</Trans>
                </Button>
              </>
            ) : filter || category || view === "important" ? (
              <>
                <p>
                  <Trans>No mail matches this filter</Trans>
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <Trans>Clear</Trans>
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
            consentDismissed ? null : (
              <InboxConsentPrompt
                recipient={shown.triageBlocked.recipient}
                onAllowed={() => {
                  setAttempt((n) => n + 1);
                  setReload((n) => n + 1);
                }}
                onDismiss={() => setConsentDismissed(true)}
              />
            )
          ) : sorting && stalled ? (
            <div
              role="status"
              className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground"
            >
              <Trans>Sorting is taking longer than usual. Your mail is below.</Trans>
              <Button variant="outline" size="sm" onClick={retry}>
                <Trans>Try sorting again</Trans>
              </Button>
            </div>
          ) : sorting ? (
            <p role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner aria-hidden="true" />
              <Trans>Sorting your mail…</Trans>
            </p>
          ) : showTodos && todos ? (
            <TodoCard
              todos={todos}
              onOpen={openMessage}
              onChange={(next) =>
                setTodosByTab((all) => ({
                  ...all,
                  [tabKey]: (all[tabKey] ?? []).map((item) => (item.id === next.id ? next : item)),
                }))
              }
            />
          ) : null}
          {resultsView ? (
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {more.token && fresh
                  ? plural(rows.length, { one: "#+ result", other: "#+ results" })
                  : plural(rows.length, { one: "# result", other: "# results" })}
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Trans>Clear</Trans>
              </Button>
            </div>
          ) : null}
          <InboxGroup
            title={<Trans>Needs reply</Trans>}
            hideAttention
            rows={groups.needsReply}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
            onArchive={archive}
            onRead={setRead}
            selectedId={selectedId}
          />
          {resultsView ? (
            <InboxGroup
              rows={[...groups.today, ...groups.earlier]}
              hideAttention={view === "important"}
              onOpen={openMessage}
              onMark={triage ? mark : undefined}
              onArchive={archive}
              onRead={setRead}
              selectedId={selectedId}
            />
          ) : (
            <>
              <InboxGroup
                // Today's mail that needs a reply is above, so this group says it holds the rest.
                title={
                  groups.needsReply.length ? <Trans>Other mail today</Trans> : <Trans>Today</Trans>
                }
                rows={groups.today}
                onOpen={openMessage}
                onMark={triage ? mark : undefined}
                onArchive={archive}
                onRead={setRead}
                selectedId={selectedId}
              />
              <InboxGroup
                title={<Trans>Earlier</Trans>}
                rows={groups.earlier}
                onOpen={openMessage}
                onMark={triage ? mark : undefined}
                onArchive={archive}
                onRead={setRead}
                selectedId={selectedId}
              />
            </>
          )}
          {filtered && fresh && more.token ? (
            <div className="grid place-items-center pb-2">
              <Button variant="outline" size="sm" disabled={more.busy} onClick={loadMore}>
                {more.busy ? <Trans>Loading…</Trans> : <Trans>Load more</Trans>}
              </Button>
            </div>
          ) : resultsView && fresh && rows.length > 0 ? (
            <p className="pb-2 text-center text-xs text-muted-foreground">
              <Trans>No more results</Trans>
            </p>
          ) : !resultsView && rows.length > 0 ? (
            <div className="grid place-items-center pb-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={focusSearch}
              >
                <Trans>Search older mail</Trans>
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
        unread={openRow?.unread}
        onArchive={
          openRow?.inInbox
            ? () => {
                // Back to the list, as Archive from the list does; the toast there offers Undo.
                archive(openRow.id);
                closeMessage();
              }
            : undefined
        }
        onRead={openRow ? (read) => setRead(openRow.id, read) : undefined}
        notice={openId ? toast : null}
      />
      <InboxShortcuts open={help} onClose={() => setHelp(false)} />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex justify-center px-4"
      >
        {openId ? null : toast}
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
