import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Bot,
  InboxListOutput,
  InboxMark,
  InboxPileCounts,
  InboxTodo,
  MailRow,
} from "@rakazo/contracts";
import { InboxFilterSchema, InboxViewCategorySchema } from "@rakazo/contracts";
import { archivableIds, bulkInChunks, digestRows, groupBySender, groupInbox } from "@rakazo/core";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import {
  Archive,
  ListChecks,
  ListFilter,
  Mail,
  MailWarning,
  Newspaper,
  Search,
  ShieldAlert,
  ShieldCheck,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { InboxConsentPrompt } from "../components/AiDataSharing";
import { AskBotButton } from "../components/AskBotButton";
import { ComposeEmail, NEW_MESSAGE } from "../components/ComposeEmail";
import { InboxCleanup } from "../components/inbox/InboxCleanup";
import { InboxDigest } from "../components/inbox/InboxDigest";
import { InboxMessageDialog } from "../components/inbox/InboxMessageDialog";
import { InboxPileTabs } from "../components/inbox/InboxPileTabs";
import type { MailMoveOp } from "../components/inbox/InboxRow";
import { InboxGroup } from "../components/inbox/InboxRow";
import {
  InboxSenderGroup,
  isSenderGroupId,
  senderGroupId,
} from "../components/inbox/InboxSenderGroup";
import { InboxShortcuts } from "../components/inbox/InboxShortcuts";
import { dueLabel, TodoCard } from "../components/inbox/TodoCard";
import { PageEmptyState } from "../components/PageEmptyState";
import { PageHeader } from "../components/PageHeader";
import { maskCurrencyWhenHidden } from "../lib/hide-amounts-preference";
import { useInboxKeyboard } from "../lib/inbox-keyboard";
import {
  inboxListInput,
  MAX_QUERY,
  readInboxListState,
  setInboxListParam,
} from "../lib/inbox-list-input";
import {
  INBOX_CHANGED_EVENT,
  prefetchInboxMessage,
  ROW_MENU_EVENT,
} from "../lib/inbox-message-cache";
import { moveInChunks } from "../lib/inbox-move";
import { syncErrorText } from "../lib/inbox-sync-error";
import { MAIL_SENT_EVENT } from "../lib/outbox";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type MeetingsState = { source: boolean; syncing: boolean; ready: boolean };

const ALL = "all";

const PHONE_QUERY = "(max-width: 767px)";
function subscribePhone(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const isPhone = () =>
  typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;

/** While a refresh reports its sync still running, ask again this often, at most this many times. */
const SYNC_POLL_MS = 2_000;
/** The wait doubles after each answer that still says syncing, up to this. */
const SYNC_POLL_MAX_MS = 10_000;
const SYNC_POLL_MAX = 60;
const couldNotArchive = (count: number) => t`Couldn't archive ${count}`;
// ponytail: bounded polling while triage runs; add a user-level event if it often takes longer than 30 seconds.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 6;
/** Needs reply lists this many rows first, then "Show N more". */
const NEEDS_REPLY_SHOWN = 5;
/** The heading a dated row sits under on the sender piles, the same split Important uses. */
const dayOf = (receivedAt: string) => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return new Date(receivedAt).getTime() >= midnight ? "today" : "earlier";
};
// ponytail: an open Inbox looks for new mail once a minute (the server syncs at most that often);
// switch to a pushed event if the delay matters.
const NEW_MAIL_POLL_MS = 60_000;
// Long enough to read the toast and reach its Undo.
const STATUS_MS = 10_000;
const PREFETCH_DELAY_MS = 250;
/** Marks the `?mail=` history entry the list pushed, so closing the message can go Back. */
const LIST_OPEN = { inboxList: true };

const coarsePointer = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

/** The account tab last chosen in this window; a removed account falls back to All. */
let rememberedTab: string | undefined;

type Status =
  | { kind: "marked"; messageId: string; mark: InboxMark; sender: string }
  | { kind: "archived"; messageId: string; subject: string }
  | { kind: "archivedMany"; messageIds: string[] }
  | {
      kind: "junked";
      op: MailMoveOp;
      count: number;
      /** The action-log batches of the call, once it has returned; Undo waits for it. */
      batches: Promise<string[]>;
    }
  | { kind: "moved"; messageId: string; subject: string };

type InboxFilter = (typeof InboxFilterSchema.options)[number];
type InboxViewCategory = (typeof InboxViewCategorySchema.options)[number];

/** Gmail's own labels for these filters. Search text goes to Gmail as typed. */
const filterLabels = (): Record<InboxFilter, string> => ({
  unread: t`Unread`,
  starred: t`Starred`,
  // The Important tab above is a different list, so the Gmail label says which one it is.
  important: t`Gmail Important`,
  attachment: t`Has attachment`,
  primary: t`Primary`,
  promotions: t`Promotions`,
  social: t`Social`,
  // The Updates pile above is a different list, so the Gmail tab says which one it is.
  updates: t`Gmail Updates`,
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

/**
 * The Inbox, or with `?cleanup=1` the cleanup screen. They are one route so the browser's Back
 * returns from cleanup to the list.
 */
export function InboxPage(props: InboxPageProps) {
  const [params, setParams] = useSearchParams();
  if (params.get("cleanup") !== "1") return <InboxListPage {...props} />;
  return (
    <InboxCleanup
      connectionId={rememberedTab}
      onRefreshed={props.onRefreshed}
      onAllowMailRules={props.onAllowMailRules}
      onOpenNewsletters={() =>
        setParams((before) => {
          const next = new URLSearchParams(before);
          next.delete("cleanup");
          next.set("pile", "newsletters");
          return next;
        })
      }
      onBack={() =>
        setParams((before) => {
          const next = new URLSearchParams(before);
          next.delete("cleanup");
          return next;
        })
      }
    />
  );
}

type InboxPageProps = {
  onConnectMail: () => void;
  /** Opens Gmail's page, where a lapsed account can be removed and connected again. */
  onReconnectMail?: () => void;
  /** Starts the sign-in that lets Praci make Gmail filters for one account. */
  onAllowMailRules?: (connectionId: string) => void;
  /** The space's name, when the user has more than one, so they know whose mail this is. */
  spaceName?: string;
  /** Called after a sync so the sidebar can refresh its unread count. */
  onRefreshed: () => void;
  /** Set while the Inbox agent panel is collapsed; shows the button that reopens it. */
  onShowAgent?: () => void;
  /** Opens the chat of the agent made for one conversation, after it exists. */
  onOpenAgent?: (bot: Bot) => void | Promise<void>;
  /** True while the Integrations overlay is open; the page reloads when it closes. */
  paused: boolean;
};

function InboxListPage({
  onConnectMail,
  onReconnectMail,
  onRefreshed,
  onShowAgent,
  onOpenAgent,
  paused,
  spaceName,
}: InboxPageProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const openId = params.get("mail");
  const listState = readInboxListState(params);
  const { filter, query, pile, category } = listState;
  const filtered = Boolean(filter || query);
  const [draft, setDraft] = useState(query);
  // Kept while the app is open, so leaving the Inbox and coming back keeps the chosen account.
  const [tab, setTab] = useState<string | undefined>(() => rememberedTab);
  useEffect(() => {
    rememberedTab = tab;
  }, [tab]);
  const [data, setData] = useState<InboxListOutput | null>(null);
  // Which request `data` answers, so a changed tab, filter or search shows loading, not old rows.
  const listKey = JSON.stringify([tab, filter, query, pile, category]);
  const [dataKey, setDataKey] = useState("");
  // Lists already fetched this session, shown at once while their key is refetched.
  const cache = useRef(new Map<string, InboxListOutput>());
  const keyRef = useRef(listKey);
  keyRef.current = listKey;
  const listRequest = useRef(0);
  // Set when a retry's sync settled: the next list answer is the first one after it, and ends "retrying".
  const awaitRetryList = useRef(false);
  const listApplied = useRef(0);
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
  // Meeting source state from the to-do reply; null when the reply failed, undefined until it arrives.
  const [meetings, setMeetings] = useState<MeetingsState | null | undefined>();
  // The focused row or group header (a `senderGroupId`); `picked` holds the checked rows.
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const lastPicked = useRef<string | undefined>(undefined);
  // Sender groups opened in the Updates and Newsletters piles, by group key.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // The Newsletters pile read as one card per issue. `?digest=1` keeps it in history, so Back leaves it.
  const digest = params.get("digest") === "1";
  // The last pile counts the server sent; a filtered list carries none, so the Spam count stays.
  const [pileCounts, setPileCounts] = useState<InboxPileCounts | undefined>();
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const [synced, setSynced] = useState(false);
  // The first sync of a new connection can take a minute; after 5 s the loading line says so.
  const [slowSync, setSlowSync] = useState(false);
  useEffect(() => {
    if (synced) return;
    const timer = setTimeout(() => setSlowSync(true), 5_000);
    return () => clearTimeout(timer);
  }, [synced]);
  // "Try again" is busy until its sync answers, so the click visibly does something.
  const [retrying, setRetrying] = useState(false);
  // A retry was made since the notice appeared; if the notice is back, it says so.
  const [retried, setRetried] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const polls = useRef(0);
  const autoRetried = useRef(false);
  // Triage still pending after the last poll: say so and offer a retry instead of spinning.
  const [stalled, setStalled] = useState(false);
  // After 15 s of the first sort the unsorted rows show, dimmed, so the page is never only grey bars.
  const [slowSort, setSlowSort] = useState(false);
  // A sync has returned a last-sync time, so the loading line never says "First sync" on an old mailbox.
  const [everSynced, setEverSynced] = useState(false);
  const appliedKey = useRef<string | null>(null);
  const archiving = useRef(new Map<string, Promise<boolean>>());
  const [composing, setComposing] = useState(false);
  // The first sort after Allow: rows keep their places until triage finishes, then regroup once.
  const [sorting, setSorting] = useState(false);
  // Rows keep their groups while a row's More menu is open, so the item under the pointer stays put.
  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  useEffect(() => {
    const onMenu = (event: Event) => setRowMenuOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener(ROW_MENU_EVENT, onMenu);
    return () => window.removeEventListener(ROW_MENU_EVENT, onMenu);
  }, []);
  const sortingRef = useRef(false);
  sortingRef.current = sorting;
  // Triage finished during the first sort, and the to-dos it made are still loading.
  const sortEnding = useRef(false);
  // "Not now" on the sorting prompt hides it for this visit only.
  const [consentDismissed, setConsentDismissed] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterTipOpen, setFilterTipOpen] = useState(false);
  const filterClosedAt = useRef(0);
  const [justAllowed, setJustAllowed] = useState(false);
  // Needs reply shows its first few rows so today's mail stays on the first screen.
  const [allReplies, setAllReplies] = useState(false);
  // Classifications as the list showed them when triage began, so rows move once, when it ends.
  // Kept per list, so another account's view never reads it; a row the user marked since is not held.
  const heldTriage = useRef<{
    key: string;
    rows: Map<
      string,
      Pick<MailRow, "needsReply" | "priority" | "reason" | "category" | "feedback">
    >;
  } | null>(null);

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
    const key = listKey;
    const request = ++listRequest.current;
    const afterRetry = awaitRetryList.current;
    const endRetry = () => {
      if (!afterRetry) return;
      awaitRetryList.current = false;
      setRetrying(false);
    };
    // A reload (a triage poll, a sync) must not throw away an answer for the list still on screen:
    // a slow search would otherwise never land while polls keep restarting it. Only a newer answer
    // for the same list, or a different list, replaces it.
    const live = () => keyRef.current === key && request > listApplied.current;
    rpc.inbox
      .list(inboxListInput(listState, tab))
      .then((next) => {
        if (!live()) return;
        listApplied.current = request;
        cache.current.set(key, next);
        if (next.pileCounts) setPileCounts(next.pileCounts);
        setData(next);
        setDataKey(key);
        endRetry();
        // A refresh of the same list keeps the pages already loaded (minus rows the fresh first
        // page now holds); only a different list starts over.
        const same = appliedKey.current === key;
        appliedKey.current = key;
        const fresh = new Set(next.rows.map((row) => row.id));
        setMore((m) =>
          same && m.rows.length > 0
            ? { ...m, rows: m.rows.filter((row) => !fresh.has(row.id)) }
            : { rows: [], token: next.nextPageToken, busy: false },
        );
      })
      .catch((cause) => {
        if (!live()) return;
        // A removed account leaves its tab behind; fall back to All.
        if (tab) setTab(undefined);
        else setError(errorText(cause));
        endRetry();
      });
  }, [tab, filter, query, pile, category, reload, paused]);

  // Checks and open groups belong to one list.
  useEffect(() => {
    setPicked(new Set());
    setExpanded(new Set());
    lastPicked.current = undefined;
  }, [listKey]);

  useEffect(() => setDraft(query), [query]);

  // To-dos load beside the list, so the card never pushes loaded rows down.
  const tabKey = tab ?? ALL;
  const todosNow = useRef(todosByTab);
  todosNow.current = todosByTab;
  const meetingsNow = useRef(meetings);
  meetingsNow.current = meetings;
  // A later answer that adds or removes a to-do waits here, so the rows under the pointer stay put.
  const heldTodos = useRef<
    { tabKey: string; todos: InboxTodo[]; state: MeetingsState | null } | undefined
  >(undefined);
  const applyTodos = (key: string, todos: InboxTodo[], state: MeetingsState | null) => {
    heldTodos.current = undefined;
    setTodosByTab((all) => ({ ...all, [key]: todos }));
    setMeetings(state);
  };
  useEffect(() => {
    if (paused) return;
    let live = true;
    const done = (todos: InboxTodo[], state: MeetingsState | null = null) => {
      if (!live) return;
      const before = todosNow.current[tabKey];
      const sameMeetings = JSON.stringify(state) === JSON.stringify(meetingsNow.current);
      if (
        before !== undefined &&
        before.length !== todos.length &&
        sameMeetings &&
        !sortingRef.current &&
        !sortEnding.current
      )
        heldTodos.current = { tabKey, todos, state };
      else applyTodos(tabKey, todos, state);
      if (sortEnding.current) {
        sortEnding.current = false;
        setSorting(false);
      }
    };
    rpc.inbox.todos
      .list(tab ? { connectionId: tab } : {})
      .then((next) => done(next.todos, next.meetings ?? null))
      // The list reports its own failure; the card just stays hidden.
      .catch(() => done([]));
    return () => {
      live = false;
    };
  }, [tab, tabKey, todoRefresh, paused]);
  // Opening another list is a change the user made, so the held to-dos show with it.
  useEffect(() => {
    const held = heldTodos.current;
    if (held) applyTodos(held.tabKey, held.todos, held.state);
  }, [listKey]);
  // The first meeting sync has no event to wait for; look again until it has a checkpoint.
  const meetingsSyncing = Boolean(meetings?.syncing);
  useEffect(() => {
    if (paused || !meetingsSyncing) return;
    const timer = setTimeout(() => setTodoRefresh((n) => n + 1), 5_000);
    return () => clearTimeout(timer);
  }, [meetingsSyncing, paused, todoRefresh]);
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
    if (!data?.triagePending) autoRetried.current = false;
    if (paused || !data?.triagePending) return;
    if (polls.current >= TRIAGE_MAX_POLLS) {
      // A sort that stalls once starts over by itself before the page says it is slow.
      if (!autoRetried.current) {
        autoRetried.current = true;
        restartSortWatch();
        setAttempt((n) => n + 1);
        setReload((n) => n + 1);
      } else if (!stalled) {
        setStalled(true);
        // Polling stopped: read the list once more so a missed finish cannot leave the sort spinning.
        setReload((n) => n + 1);
      }
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
    let live = true;
    let wake: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The server queues the sync and answers at once; ask again until it is done, then list.
    const sync = async () => {
      let result = await rpc.inbox.refresh({});
      if (result?.syncedAt && live) setEverSynced(true);
      for (let i = 0; i < SYNC_POLL_MAX && live && result?.syncing; i++) {
        await new Promise<void>((resolve) => {
          wake = resolve;
          timer = setTimeout(resolve, Math.min(SYNC_POLL_MS * 2 ** i, SYNC_POLL_MAX_MS));
        });
        if (live) result = await rpc.inbox.refresh({});
        if (result?.syncedAt && live) setEverSynced(true);
      }
    };
    sync()
      .catch((cause) => {
        if (live) setError(errorText(cause));
      })
      .then(() => {
        if (!live) return setRetrying(false);
        // "Try again" stays busy until the list reloaded after this sync answers.
        awaitRetryList.current = true;
        setSynced(true);
        setReload((n) => n + 1);
        onRefreshed();
      });
    return () => {
      live = false;
      clearTimeout(timer);
      wake?.();
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
  // Allow starts the sort clock: the sync that queues triage can take a while, and the list says
  // so meanwhile. If triage never starts, the page goes back to normal after a minute.
  useEffect(() => {
    if (!sorting || shown?.triagePending) return;
    const timer = setTimeout(() => {
      if (!sortEnding.current) setSorting(false);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [sorting, shown?.triagePending]);
  const narrowed = triage && Boolean(category);
  // A search or narrowed list is one date-ordered list under a result count, not Needs reply / Today / Earlier.
  const resultsView = filtered || narrowed;
  const activeFilterLabel = filter
    ? filterLabels()[filter]
    : triage && category
      ? categoryLabels()[category]
      : undefined;
  // Updates and Newsletters list one group per sender; Spam is a flat list; Important is dated.
  const grouped = pile === "updates" || pile === "newsletters";
  const senderGroups = useMemo(() => (grouped ? groupBySender(rows) : []), [grouped, rows]);
  const digestOn = digest && pile === "newsletters";
  const digestList = useMemo(
    () => (digestOn ? digestRows(rows, new Date()) : []),
    [digestOn, rows],
  );
  // While triage runs on a list that already shows classifications, new answers wait: the
  // classifications from before stay, and rows classified later join the grouping when it finishes.
  const holdWhilePending = useCallback(
    (list: MailRow[]) => {
      if ((!shown?.triagePending && !rowMenuOpen) || stalled || filtered) {
        heldTriage.current = null;
        return list;
      }
      if (heldTriage.current?.key !== listKey) {
        heldTriage.current = {
          key: listKey,
          rows: new Map(
            list.map((row) => [
              row.id,
              {
                needsReply: row.needsReply,
                priority: row.priority,
                reason: row.reason,
                category: row.category,
                feedback: row.feedback,
              },
            ]),
          ),
        };
      }
      const held = heldTriage.current.rows;
      const none = {
        needsReply: null,
        priority: null,
        reason: null,
        category: null,
        feedback: null,
      };
      return list.map((row) => {
        const before = held.get(row.id);
        // A mark or undo changes the row's classification now, so it is not held back.
        if (before && before.feedback !== row.feedback) return row;
        const { feedback: _, ...classes } = before ?? none;
        return { ...row, ...classes };
      });
    },
    [shown?.triagePending, rowMenuOpen, stalled, filtered, listKey],
  );
  const groups = useMemo(
    () =>
      groupInbox(
        sorting
          ? // Rows sorted so far show nothing new until the whole sort lands. An open row menu
            // holds the blank view, so the rows do not move when the sort finishes.
            (rowMenuOpen ? holdWhilePending : (list: MailRow[]) => list)(
              rows.map((row) => ({
                ...row,
                needsReply: null,
                priority: null,
                reason: null,
                category: null,
              })),
            )
          : resultsView
            ? rows.map((row) => ({ ...row, needsReply: null }))
            : holdWhilePending(rows),
        new Date(),
      ),
    [rows, resultsView, sorting, rowMenuOpen, holdWhilePending],
  );
  const replyRows = allReplies ? groups.needsReply : groups.needsReply.slice(0, NEEDS_REPLY_SHOWN);
  const hiddenReplies = groups.needsReply.length - replyRows.length;
  // Display order. A group header takes its own id; a sender with one message shows as that message.
  const ids = useMemo(() => {
    if (digestOn) return groupBySender(digestList).map((group) => group.newest.id);
    if (grouped)
      return senderGroups.flatMap((group) =>
        group.count === 1
          ? [group.newest.id]
          : [
              senderGroupId(group.key),
              ...(expanded.has(group.key) ? group.rows.map((row) => row.id) : []),
            ],
      );
    if (pile === "spam") return rows.map((row) => row.id);
    return [...replyRows, ...groups.today, ...groups.earlier].map((row) => row.id);
  }, [digestOn, digestList, grouped, senderGroups, expanded, pile, rows, groups, replyRows]);
  // The messages the open message's arrows and the prefetch can reach.
  const messageIds = useMemo(() => ids.filter((id) => !isSenderGroupId(id)), [ids]);
  const accounts = data?.accounts ?? [];
  // The list answers slowly and is the only thing that names the accounts, so the connections
  // list (fast) decides "no mail connected" first. Any Gmail connection, even a lapsed one, keeps the normal path.
  const [noGmail, setNoGmail] = useState(false);
  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.connections
      .list()
      .then((rows) => {
        if (live) setNoGmail(!rows.some((row) => row.provider.trim().toLowerCase() === "gmail"));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [paused]);
  const noAccounts = data ? accounts.length === 0 : noGmail;
  // With two or more accounts the Filter menu picks one; the button then names it.
  const tabLabel =
    accounts.length > 1
      ? accounts.find((account) => account.connectionId === tab)?.label
      : undefined;
  const failed = error || (shown ? syncErrorText(shown, retried && !retrying) : "");
  const limited =
    !error && Boolean(shown?.rateLimitedAccounts?.length) && !shown?.reconnectAccounts.length;
  useEffect(() => {
    if (!failed) setRetried(false);
  }, [failed]);
  const todos = todosByTab[tabKey];
  // A lapsed sign-in is fixed by signing in again; trying again would fail the same way.
  const reconnect = !error && Boolean(shown?.reconnectAccounts.length);
  // With nothing to show, the problem is the page, not a line above an empty list.
  const failedEmpty =
    Boolean(failed) && (!shown || rows.length === 0) && !(data && accounts.length === 0);
  // Cleanup, Filter, Compose and the pile tabs act on loaded mail, so they wait for it.
  const tools = accounts.length > 0 && !failedEmpty;
  // The once-a-minute new-mail sync must not restart the sorting clock, or the stall line never shows.
  const restartSortWatch = () => {
    polls.current = 0;
    setStalled(false);
  };
  const retry = () => {
    if (retrying) return;
    setRetried(true);
    setError("");
    setRetrying(true);
    restartSortWatch();
    setAttempt((n) => n + 1);
    setReload((n) => n + 1);
  };
  const setParam = (name: Parameters<typeof setInboxListParam>[1], value: string) =>
    setParams(setInboxListParam(params, name, value));
  // Meeting follow-ups show whenever the user has any or a meeting source, with or without mail triage.
  const meetingTodos = Boolean(meetings?.source) || (todos ?? []).some((todo) => todo.meetingId);
  const showTodos = (triage || meetingTodos) && !sorting && pile === "important";
  // The first sort shows no rows at all: they would regroup and the To do card would push them down.
  const sortingNow = sorting || firstSort;
  useEffect(() => {
    if (!sortingNow) return setSlowSort(false);
    const timer = setTimeout(() => setSlowSort(true), 15_000);
    return () => clearTimeout(timer);
  }, [sortingNow]);
  const sortingRows = sortingNow && !stalled && !slowSort;
  const loading =
    !shown ||
    sortingRows ||
    (!filtered && shown.rows.length === 0 && !synced) ||
    // The To do card is waited for on the Important pile even before it is known to show (meetings
    // arrive with it), so it never pushes the loaded rows down.
    (pile === "important" && !paused && todos === undefined && !sorting);
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  // Nothing to search in a mailbox with no mail in any pile.
  const mailboxEmpty =
    !loading &&
    rows.length === 0 &&
    !query &&
    !filter &&
    !category &&
    (pileCounts ? Object.values(pileCounts).every((n) => n === 0) : true);
  // Applies a change to every copy of the rows: the list, the pages after it and the cached lists.
  const patchRows = (change: (rows: MailRow[], searched: boolean) => MailRow[]) => {
    const patch = (list: InboxListOutput, searched: boolean) => ({
      ...list,
      rows: change(list.rows, searched),
    });
    setData((list) => list && patch(list, Boolean(query)));
    setMore((m) => ({ ...m, rows: change(m.rows, Boolean(query)) }));
    // The key is [tab, filter, query, pile, category].
    for (const [key, list] of cache.current)
      cache.current.set(key, patch(list, Boolean(JSON.parse(key)[2])));
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
    // A touch screen has no keyboard cursor to carry over, so no row stays highlighted.
    if (selectedId === messageId) setSelectedId(coarsePointer() ? undefined : neighbor);
    const subject = rows.find((row) => row.id === messageId)?.subject ?? "";
    // A search also finds archived mail, so its row stays and says Archived.
    patchRows((list, searched) =>
      searched
        ? list.map((row) => (row.id === messageId ? { ...row, inInbox: false } : row))
        : list.filter((row) => row.id !== messageId),
    );
    setStatus({ kind: "archived", messageId, subject });
    // A pending Move to Inbox finishes first, so the archive is not overtaken by it.
    const call = (archiving.current.get(messageId) ?? Promise.resolve()).then(() =>
      rpc.inbox.archive({ messageId }),
    );
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
  const spamView = pile === "spam";
  // Checked rows that are still listed, so a reload never leaves a count for rows that are gone.
  const pickedRows = useMemo(() => rows.filter((row) => picked.has(row.id)), [rows, picked]);
  const pickedCount = pickedRows.length;
  const pickedSet = useMemo(() => new Set(pickedRows.map((row) => row.id)), [pickedRows]);
  const groupRows = (id: string) =>
    senderGroups.find((group) => senderGroupId(group.key) === id)?.rows ?? [];
  // Checks or unchecks rows together; unchecking applies only when every one of them is checked.
  const togglePicked = (messageIds: string[]) =>
    setPicked((current) => {
      const next = new Set(current);
      const all = messageIds.every((id) => next.has(id));
      for (const id of messageIds) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  // Shift extends from the last checked row over the rows in view; a group header is not in the range.
  // ponytail: the range covers the visible message rows only; a closed group's rows join it only through its own checkbox.
  const pick = (messageId: string, { shift }: { shift: boolean }) => {
    const anchor = lastPicked.current;
    const from = shift && anchor ? messageIds.indexOf(anchor) : -1;
    const to = messageIds.indexOf(messageId);
    lastPicked.current = messageId;
    if (from < 0 || to < 0) return togglePicked([messageId]);
    const range = messageIds.slice(Math.min(from, to), Math.max(from, to) + 1);
    setPicked((current) => new Set([...current, ...range]));
  };
  const toggleId = (id: string) => {
    if (isSenderGroupId(id)) togglePicked(groupRows(id).map((row) => row.id));
    else pick(id, { shift: false });
  };
  // One action archives the whole selection or group (50 threads per call); Undo puts back what it archived.
  // The rows leave the list at once; the selection moves on to the nearest row or group that stays.
  const dropFromView = (gone: Set<string>) => {
    setPicked(new Set());
    const stays = (id: string) =>
      isSenderGroupId(id) ? !groupRows(id).every((row) => gone.has(row.id)) : !gone.has(id);
    if (selectedId && !stays(selectedId)) {
      const index = ids.indexOf(selectedId);
      setSelectedId(
        coarsePointer()
          ? undefined
          : (ids.slice(index + 1).find(stays) ??
              ids.slice(0, Math.max(index, 0)).reverse().find(stays)),
      );
    }
    patchRows((list, searched) =>
      searched
        ? list.map((row) => (gone.has(row.id) ? { ...row, inInbox: false } : row))
        : list.filter((row) => !gone.has(row.id)),
    );
  };
  const archiveMany = (candidates: MailRow[]) => {
    const messageIds = archivableIds(candidates, spamView);
    if (messageIds.length === 0) return;
    dropFromView(new Set(messageIds));
    setStatus({ kind: "archivedMany", messageIds });
    setError("");
    // A pending Move to Inbox finishes first, so the archive is not overtaken by it.
    const call = Promise.all(messageIds.map((id) => archiving.current.get(id))).then(() =>
      bulkInChunks(messageIds, (slice) =>
        rpc.inbox.archiveMany({ messageIds: slice, ...(spamView ? { allowSpam: true } : {}) }),
      ),
    );
    // Each id resolves to whether it was archived, so Undo never overtakes the call or restores a failure.
    for (const id of messageIds)
      archiving.current.set(
        id,
        call.then(
          (result) => result.done.includes(id),
          () => false,
        ),
      );
    call
      .then((result) => {
        onRefreshed();
        if (result.failed.length) setError(couldNotArchive(result.failed.length));
        // A failed id comes back with the real list; the Spam count follows the archive.
        if (result.failed.length || spamView) setReload((n) => n + 1);
      })
      .catch((cause) => {
        setError(errorText(cause));
        setReload((n) => n + 1);
      });
  };
  const unarchiveMany = async (messageIds: string[]) => {
    setStatus(null);
    const saved = await Promise.all(messageIds.map((id) => archiving.current.get(id)));
    for (const id of messageIds) archiving.current.delete(id);
    // An id whose archive failed is already back with the reloaded list.
    const restore = messageIds.filter((_, index) => saved[index] !== false);
    if (restore.length === 0) return;
    setError("");
    bulkInChunks(restore, (slice) => rpc.inbox.unarchiveMany({ messageIds: slice }))
      // A thread Gmail could not put back stays archived, and the reloaded list shows that.
      .then(onRefreshed)
      .catch((cause) => setError(errorText(cause)))
      .then(() => setReload((n) => n + 1));
  };
  // Spam, not spam and trash work like a bulk archive: the rows leave at once and Undo reverses the logged batches.
  const moveMany = (op: MailMoveOp, candidates: MailRow[]) => {
    const messageIds = candidates
      .filter((row) => (op === "notSpam" ? row.pile === "spam" : row.inInbox))
      .map((row) => row.id);
    if (messageIds.length === 0) return;
    dropFromView(new Set(messageIds));
    setError("");
    const batchIds: string[] = [];
    const batches = moveInChunks(op, messageIds, (input) => rpc.inbox.moveMany(input), batchIds)
      .then((result) => {
        onRefreshed();
        if (result.failed.length) setError(couldNotArchive(result.failed.length));
        // Failed ids come back with the real list, and the pile counts follow.
        setReload((n) => n + 1);
        return batchIds;
      })
      .catch((cause) => {
        setError(errorText(cause));
        setReload((n) => n + 1);
        return batchIds;
      });
    setStatus({ kind: "junked", op, count: messageIds.length, batches });
  };
  const undoMove = async (batches: Promise<string[]>) => {
    setStatus(null);
    const batchIds = await batches;
    if (batchIds.length === 0) return;
    setError("");
    Promise.all(batchIds.map((batchId) => rpc.inbox.actions.undo({ batchId })))
      .then(onRefreshed)
      .catch((cause) => setError(errorText(cause)))
      .then(() => setReload((n) => n + 1));
  };
  const moveOne = (op: MailMoveOp, messageId: string) =>
    moveMany(
      op,
      rows.filter((row) => row.id === messageId),
    );
  // The checked rows when there are any, else the focused row or group.
  const archiveFocused = (id: string | undefined) => {
    if (pickedRows.length > 0) return archiveMany(pickedRows);
    if (!id) return;
    if (isSenderGroupId(id)) return archiveMany(groupRows(id));
    const target = rows.find((row) => row.id === id);
    if (target?.inInbox) archive(id);
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
  // Allowing syncs again, which is what queues triage now that it may run. It shows while the
  // first sync still loads the list, so the choice is not hidden behind the skeleton.
  const consentPrompt =
    pile === "important" &&
    shown?.triageBlocked?.reason === "needs_consent" &&
    !consentDismissed ? (
      <InboxConsentPrompt
        recipient={shown.triageBlocked.recipient}
        onAllowed={() => {
          restartSortWatch();
          setJustAllowed(true);
          // An already sorted mailbox has nothing to wait for; the clearing effects never rerun for it.
          if (shown?.rows.every((row) => row.needsReply === null)) setSorting(true);
          setAttempt((n) => n + 1);
          setReload((n) => n + 1);
        }}
        onDismiss={() => setConsentDismissed(true)}
        shownElsewhere={failed && !failedEmpty ? failed : undefined}
      />
    ) : null;
  // A to-do made from a visible Needs reply row would show the same task twice, so the card drops
  // it and the open mail offers its completion. Only the first rows count, so "Show more" does not
  // change the card.
  const replyRowIds = new Set(groups.needsReply.slice(0, NEEDS_REPLY_SHOWN).map((row) => row.id));
  const repeatsRow = (todo: InboxTodo) =>
    todo.doneAt === null && Boolean(todo.messageId) && replyRowIds.has(todo.messageId as string);
  const todoRowDue = new Map(
    (todos ?? []).filter(repeatsRow).map((todo) => [todo.messageId as string, todo.dueOn ?? null]),
  );
  const cardTodos = todos?.filter((todo) => !repeatsRow(todo));
  // Its checkbox is gone from the card, so the open mail offers the completion instead.
  const openReplyTodo = openId
    ? todos?.find((todo) => todo.messageId === openId && repeatsRow(todo))
    : undefined;
  const changeTodo = (next: InboxTodo) => {
    const swap = (items: InboxTodo[]) => items.map((item) => (item.id === next.id ? next : item));
    // A held answer must not bring the old state back when it is applied.
    if (heldTodos.current) heldTodos.current.todos = swap(heldTodos.current.todos);
    setTodosByTab((all) => ({ ...all, [tabKey]: swap(all[tabKey] ?? []) }));
  };
  const todoCard = cardTodos ? (
    <TodoCard
      todos={cardTodos}
      compact={phone}
      meetings={meetings ?? undefined}
      onOpen={openMessage}
      onChange={changeTodo}
    />
  ) : null;
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
  const openIndex = openId ? messageIds.indexOf(openId) : -1;
  const toggleGroup = (id: string) => {
    const key = id.slice(senderGroupId("").length);
    setSelectedId(id);
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };
  const focusSearch = () => searchRef.current?.querySelector("input")?.focus();
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    for (const name of ["q", "filter", "category", "pile", "digest", "mail"]) next.delete(name);
    setParams(next);
  };

  useInboxKeyboard({
    ids,
    selectedId,
    enabled: !paused && !openId && !composing && !help,
    select: setSelectedId,
    // Enter on a group header opens or closes the group.
    open: (id) => (isSenderGroupId(id) ? toggleGroup(id) : openMessage(id)),
    focusSearch,
    compose: accounts.length > 0 ? () => setComposing(true) : undefined,
    toggle: toggleId,
    hasPicked: pickedRows.length > 0,
    archive: archiveFocused,
    help: () => setHelp(true),
  });
  // Escape unchecks the rows when no dialog or field is using the key.
  useEffect(() => {
    if (picked.size === 0 || openId || composing || help) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input,textarea,select,[contenteditable]")) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      setPicked(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked.size, openId, composing, help]);
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
    for (const id of messageIds.slice(0, 3)) prefetchInboxMessage(id);
  }, [messageIds]);
  // Debounced so holding j or k does not fetch every row passed over.
  useEffect(() => {
    if (!selectedId || isSenderGroupId(selectedId)) return;
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
          // Not scrolled to: after a reply the row has moved to another group, and the list stays put.
          ?.focus({ preventScroll: true }),
      );
    }
  }, [openId, selectedId]);

  // The main action of the empty page, as Connect mail is; a small one beside a line above rows.
  const fixVariant = failedEmpty ? "default" : "outline";
  const fixButton = reconnect ? (
    <Button
      variant={fixVariant}
      size={failedEmpty ? "default" : "sm"}
      onClick={onReconnectMail ?? onConnectMail}
    >
      <Trans>Reconnect Gmail</Trans>
    </Button>
  ) : (
    <Button
      variant={fixVariant}
      size={failedEmpty ? "default" : "sm"}
      onClick={retry}
      aria-disabled={retrying}
      aria-busy={retrying}
      className="relative"
    >
      <span className={retrying ? "opacity-0" : undefined}>
        <Trans>Try again</Trans>
      </span>
      {retrying ? <Spinner className="absolute" aria-hidden="true" /> : null}
    </Button>
  );

  const count = status?.kind === "archivedMany" ? status.messageIds.length : 0;
  const toast = status ? (
    <div
      data-toast-avoid
      className="pointer-events-auto flex max-w-full items-center gap-2 rounded-lg bg-primary py-1 ps-3 pe-1 text-sm text-primary-foreground shadow-lg"
    >
      {status.kind === "archivedMany" ? (
        <Trans>Archived {count}</Trans>
      ) : status.kind === "archived" ? (
        <span className="min-w-0 truncate" dir="auto">
          {status.subject ? (
            <Trans>Archived "{maskCurrencyWhenHidden(status.subject)}"</Trans>
          ) : (
            <Trans>Archived</Trans>
          )}
        </span>
      ) : status.kind === "junked" ? (
        status.op === "spam" ? (
          <Trans>Marked {status.count} as spam</Trans>
        ) : status.op === "trash" ? (
          <Trans>Moved {status.count} to trash</Trans>
        ) : (
          <Trans>Marked {status.count} as not spam</Trans>
        )
      ) : status.kind === "moved" ? (
        <span className="min-w-0 truncate" dir="auto">
          <Trans>Moved "{maskCurrencyWhenHidden(status.subject)}" to Inbox</Trans>
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
          status.kind === "archivedMany"
            ? unarchiveMany(status.messageIds)
            : status.kind === "junked"
              ? undoMove(status.batches)
              : status.kind === "archived"
                ? unarchive(status.messageId)
                : status.kind === "moved"
                  ? archive(status.messageId)
                  : mark(status.messageId, null)
        }
      >
        <Trans>Undo</Trans>
      </Button>
    </div>
  ) : null;

  const searchMeta = (
    <>
      {mailboxEmpty ? null : (
        <form
          ref={searchRef}
          className="min-w-40 flex-1 basis-full @lg/ph:basis-0"
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
              // Short enough to fit beside the agent panel; the hover title keeps the example.
              placeholder={t`Search mail`}
              title={t`Search mail, e.g. from:sam has:attachment`}
              aria-label={t`Search mail`}
              // Nothing to search or filter before mail is connected.
              disabled={noAccounts}
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
                    clearFilters();
                    searchRef.current?.querySelector("input")?.focus();
                  }}
                >
                  <X aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </form>
      )}
    </>
  );

  // The bottom padding lets the last rows scroll clear of a toast.
  return (
    <div
      data-inbox-page
      className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-20 pt-2 md:px-7 md:pt-5"
    >
      <div className="mx-auto max-w-[1440px]">
        {/* A sticky box sticks inside the scroller's padding, so -top cancels it: rows never show above the header. mb-2 keeps the cards below clear of it. */}
        <div className="sticky -top-2 z-20 -mx-4 -mt-2 mb-2 bg-background px-4 pt-2 md:-top-5 md:-mx-7 md:-mt-5 md:px-7 md:pt-5">
          <PageHeader
            compact
            title={<Trans>Inbox</Trans>}
            spaceName={phone ? undefined : spaceName}
            meta={phone ? undefined : searchMeta}
            actions={
              <>
                {tools ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="inbox-cleanup"
                          aria-label={t`Cleanup`}
                          className="pointer-coarse:h-10 pointer-coarse:min-w-10"
                          onClick={() =>
                            setParams((before) => {
                              const next = new URLSearchParams(before);
                              next.set("cleanup", "1");
                              return next;
                            })
                          }
                        />
                      }
                    >
                      <ListChecks aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{t`Cleanup`}</TooltipContent>
                  </Tooltip>
                ) : null}
                {tools ? (
                  <DropdownMenu
                    onOpenChange={(open) => {
                      setFilterMenuOpen(open);
                      if (!open) {
                        // Closing returns focus to the button, which must not reopen its tooltip.
                        setFilterTipOpen(false);
                        filterClosedAt.current = Date.now();
                      }
                    }}
                  >
                    <Tooltip
                      open={filterTipOpen && !filterMenuOpen}
                      onOpenChange={(open) => {
                        if (!open || Date.now() - filterClosedAt.current > 400)
                          setFilterTipOpen(open);
                      }}
                    >
                      <TooltipTrigger
                        render={
                          <DropdownMenuTrigger
                            data-testid="inbox-filter"
                            render={
                              <Button
                                variant={
                                  filter || (triage && category) || tabLabel
                                    ? "secondary"
                                    : "outline"
                                }
                                size="sm"
                                className="pointer-coarse:h-10 pointer-coarse:min-w-10"
                              />
                            }
                            // The button keeps one width: the filter's name is in the results bar.
                            aria-label={
                              tabLabel
                                ? undefined
                                : activeFilterLabel
                                  ? `${t`Filter`}: ${activeFilterLabel}`
                                  : t`Filter`
                            }
                          >
                            <ListFilter aria-hidden="true" />
                            {tabLabel}
                          </DropdownMenuTrigger>
                        }
                      />
                      <TooltipContent>{t`Filter`}</TooltipContent>
                    </Tooltip>
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
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Trans>Gmail tabs</Trans>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {(["primary", "promotions", "social", "updates"] as const).map(
                              (name) => (
                                <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                                  {filterLabels()[name]}
                                </DropdownMenuRadioItem>
                              ),
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {triage ? (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Trans>Categories</Trans>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {/* Newsletters is a pile tab, so the category of that name is left out. */}
                              {InboxViewCategorySchema.options
                                .filter((name) => name !== "newsletter")
                                .map((name) => (
                                  <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                                    {categoryLabels()[name]}
                                  </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : null}
                      </DropdownMenuRadioGroup>
                      {accounts.length > 1 ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>
                              <Trans>Account</Trans>
                            </DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={tab ?? ALL}
                              onValueChange={(value) =>
                                setTab(value === ALL ? undefined : String(value))
                              }
                            >
                              <DropdownMenuRadioItem value={ALL} closeOnClick>
                                <Trans>All</Trans>
                              </DropdownMenuRadioItem>
                              {accounts.map((account) => (
                                <DropdownMenuRadioItem
                                  key={account.connectionId}
                                  value={account.connectionId}
                                  closeOnClick
                                >
                                  {account.label}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuGroup>
                        </>
                      ) : null}
                      {filter || (triage && category) ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setParam(filter ? "filter" : "category", "")}
                          >
                            <Trans>Clear</Trans>
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                {tools ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="pointer-coarse:h-10 pointer-coarse:min-w-10"
                          aria-label={t`Compose`}
                          onClick={() => setComposing(true)}
                        />
                      }
                    >
                      <SquarePen aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{t`Compose`}</TooltipContent>
                  </Tooltip>
                ) : null}
                {onShowAgent ? <AskBotButton botName="Inbox agent" onClick={onShowAgent} /> : null}
              </>
            }
          />
          {tools && !query ? (
            <div className="flex flex-wrap items-center gap-2">
              <InboxPileTabs
                value={pile}
                counts={pileCounts}
                onChange={(next) => setParam("pile", next === "important" ? "" : next)}
              />
              {pile === "newsletters" ? (
                <Toggle
                  size="sm"
                  variant="outline"
                  // Pressed shows as a dark border, not a fill: the selected pile tab is the one filled control.
                  className="-mt-2 mb-4 ms-auto aria-pressed:border-foreground aria-pressed:bg-transparent data-[state=on]:bg-transparent"
                  pressed={digest}
                  onPressedChange={(on) => {
                    const next = new URLSearchParams(params);
                    if (on) next.set("digest", "1");
                    else next.delete("digest");
                    setParams(next);
                  }}
                >
                  <Newspaper aria-hidden="true" />
                  <Trans>Digest</Trans>
                </Toggle>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* On a phone the search sits under the sticky title and tabs and scrolls away with the list. */}
        {phone ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {searchMeta}
          </div>
        ) : null}

        {failed && !failedEmpty ? (
          <div
            role="alert"
            className={`mb-4 flex items-center gap-3 text-sm ${limited ? "text-warning" : "text-destructive"}`}
          >
            <span>{failed}</span>
            {fixButton}
          </div>
        ) : null}

        {failedEmpty ? (
          <PageEmptyState
            icon={<MailWarning className="size-8" strokeWidth={1.6} aria-hidden="true" />}
            title={
              reconnect ? (
                <Trans>Gmail needs to be reconnected</Trans>
              ) : (
                <Trans>Your mail didn't load</Trans>
              )
            }
            description={
              <span role="alert" className={limited ? "text-warning" : undefined}>
                {reconnect ? (
                  <Trans>Gmail signed this account out. Sign in again to see your mail here.</Trans>
                ) : (
                  failed
                )}
              </span>
            }
          >
            {fixButton}
          </PageEmptyState>
        ) : noAccounts && todos === undefined && !paused ? (
          // Whether the user has meeting follow-ups decides the page, so it waits for them.
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-9 w-full" />
          </div>
        ) : noAccounts && meetingTodos ? (
          // A meeting-only user: the follow-ups come first, with a plain way to add mail.
          <>
            {todoCard}
            <Button onClick={onConnectMail}>
              <Trans>Connect mail</Trans>
            </Button>
          </>
        ) : noAccounts ? (
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
            {consentPrompt}
            {sortingRows ? (
              // After Allow it takes the consent card's place at its height, so the list does not jump.
              <p
                role="status"
                className={cn(
                  "mb-2 flex min-h-9 items-center gap-2 text-sm text-muted-foreground",
                  justAllowed && "min-h-16",
                )}
              >
                <Spinner aria-hidden="true" />
                <Trans>Sorting your mail…</Trans>
              </p>
            ) : null}
            {synced || sortingRows || consentPrompt ? null : (
              <p role="status" className="text-sm text-muted-foreground">
                {slowSync && !everSynced && !data?.syncedAt ? (
                  <Trans>First sync can take a minute</Trans>
                ) : (
                  <Trans>Reading your mail…</Trans>
                )}
              </p>
            )}
            {/* Real rows are 57px apart with no gap, so the list does not jump when they arrive.
                Beside the consent card, blank bars look stalled, so only the card shows. */}
            <div hidden={Boolean(consentPrompt) && !sortingRows}>
              {[0, 1, 2, 3, 4].map((n) => (
                <Skeleton
                  key={n}
                  className="h-[57px] w-full rounded-none border-b border-background"
                />
              ))}
            </div>
          </div>
        ) : shown && rows.length === 0 ? (
          <>
            {/* Meeting follow-ups do not depend on the mail list, so an empty list does not hide them. */}
            {pile === "important" && meetingTodos ? todoCard : null}
            {failed ? null : (
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
                ) : filter || category ? (
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
            )}
          </>
        ) : shown ? (
          <>
            {consentPrompt ? (
              consentPrompt
            ) : sorting && stalled ? (
              <div
                role="status"
                className="mb-4 flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground"
              >
                <Trans>Sorting is taking longer than usual. Your mail is below.</Trans>
                <Button variant="outline" size="sm" onClick={retry}>
                  <Trans>Try sorting again</Trans>
                </Button>
              </div>
            ) : sorting && slowSort ? (
              <p
                role="status"
                className="mb-4 flex min-h-9 items-center gap-2 text-sm text-muted-foreground"
              >
                <Spinner aria-hidden="true" />
                <Trans>Sorting your mail…</Trans>
              </p>
            ) : showTodos ? (
              todoCard
            ) : null}
            {resultsView ? (
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {more.token && fresh
                    ? plural(rows.length, { one: "#+ result", other: "#+ results" })
                    : plural(rows.length, { one: "# result", other: "# results" })}
                  {activeFilterLabel ? ` · ${activeFilterLabel}` : null}
                </span>
                {/* A search has the X in its box, which clears the filter too; a filter alone has only this. */}
                {query && draft ? null : (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <Trans>Clear</Trans>
                  </Button>
                )}
              </div>
            ) : null}
            {pickedRows.length > 0 ? (
              <div className="sticky top-0 z-20 mb-3 flex items-center gap-2 rounded-lg bg-muted py-1 ps-3 pe-1 text-sm">
                <span className="tabular-nums">{t`${pickedCount} selected`}</span>
                <Button size="sm" onClick={() => archiveMany(pickedRows)}>
                  <Archive aria-hidden="true" />
                  <Trans>Archive</Trans>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={spamView ? t`Not spam` : t`Spam`}
                  title={spamView ? t`Not spam` : t`Spam`}
                  onClick={() => moveMany(spamView ? "notSpam" : "spam", pickedRows)}
                >
                  {spamView ? (
                    <ShieldCheck aria-hidden="true" />
                  ) : (
                    <ShieldAlert aria-hidden="true" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t`Trash`}
                  title={t`Trash`}
                  onClick={() => moveMany("trash", pickedRows)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                  <Trans>Clear</Trans>
                </Button>
              </div>
            ) : null}
            {/* The sort is about to regroup these rows, so a tap now could open a different mail: inert until it lands. */}
            <div
              className={cn(sorting && slowSort && !stalled && "opacity-60")}
              inert={sorting && slowSort && !stalled}
            >
              {digestOn ? (
                <InboxDigest
                  rows={digestList}
                  onOpen={openMessage}
                  onArchiveAll={() => archiveMany(digestList)}
                  onShowPile={() => {
                    const next = new URLSearchParams(params);
                    next.delete("digest");
                    setParams(next);
                  }}
                  selectedId={selectedId}
                />
              ) : grouped ? (
                <section className="mb-5">
                  <div className="border-t border-foreground/10">
                    {senderGroups.map((group, index) => {
                      const day = dayOf(group.newest.receivedAt);
                      const first =
                        index === 0 ||
                        day !== dayOf(senderGroups[index - 1]?.newest.receivedAt ?? "");
                      return (
                        <Fragment key={group.key}>
                          {first ? (
                            <h2 className="mb-2 mt-5 text-[13px] font-semibold text-muted-foreground first:mt-0">
                              {day === "today" ? <Trans>Today</Trans> : <Trans>Earlier</Trans>}
                            </h2>
                          ) : null}
                          <InboxSenderGroup
                            group={group}
                            expanded={expanded.has(group.key)}
                            onToggle={() => toggleGroup(senderGroupId(group.key))}
                            onOpen={openMessage}
                            onMark={triage ? mark : undefined}
                            onArchive={archive}
                            onRead={setRead}
                            onArchiveGroup={() => archiveMany(group.rows)}
                            onPickGroup={() => togglePicked(group.rows.map((row) => row.id))}
                            selectedId={selectedId}
                            pickedIds={pickedSet}
                            onPick={pick}
                            onMove={moveOne}
                            hideNewsletter={pile === "newsletters"}
                          />
                        </Fragment>
                      );
                    })}
                  </div>
                </section>
              ) : spamView ? (
                <InboxGroup
                  rows={rows}
                  onOpen={openMessage}
                  onMark={triage ? mark : undefined}
                  onArchive={archive}
                  onRead={setRead}
                  selectedId={selectedId}
                  pickedIds={pickedSet}
                  onPick={pick}
                  onMove={moveOne}
                  showArchived={false}
                />
              ) : (
                <>
                  <InboxGroup
                    title={<Trans>Needs reply</Trans>}
                    hideAttention
                    rows={replyRows}
                    todoDue={todoRowDue}
                    unreadTotal={groups.needsReply.filter((row) => row.unread).length}
                    onOpen={openMessage}
                    onMark={triage ? mark : undefined}
                    onArchive={archive}
                    onRead={setRead}
                    selectedId={selectedId}
                    pickedIds={pickedSet}
                    onPick={pick}
                    onMove={moveOne}
                  />
                  {hiddenReplies > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mb-5 -mt-3 text-muted-foreground"
                      onClick={() => setAllReplies(true)}
                    >
                      <Trans>Show {hiddenReplies} more</Trans>
                    </Button>
                  ) : null}
                  {resultsView ? (
                    <InboxGroup
                      query={query}
                      rows={[...groups.today, ...groups.earlier]}
                      onOpen={openMessage}
                      onMark={triage ? mark : undefined}
                      onArchive={archive}
                      onRead={setRead}
                      selectedId={selectedId}
                      pickedIds={pickedSet}
                      onPick={pick}
                      onMove={moveOne}
                    />
                  ) : (
                    <>
                      <InboxGroup
                        // Today's mail that needs a reply is above, so this group says it holds the rest.
                        title={
                          groups.needsReply.length ? (
                            <Trans>Other mail today</Trans>
                          ) : (
                            <Trans>Today</Trans>
                          )
                        }
                        rows={groups.today}
                        onOpen={openMessage}
                        onMark={triage ? mark : undefined}
                        onArchive={archive}
                        onRead={setRead}
                        selectedId={selectedId}
                        pickedIds={pickedSet}
                        onPick={pick}
                        onMove={moveOne}
                      />
                      <InboxGroup
                        title={<Trans>Earlier</Trans>}
                        rows={groups.earlier}
                        onOpen={openMessage}
                        onMark={triage ? mark : undefined}
                        onArchive={archive}
                        onRead={setRead}
                        selectedId={selectedId}
                        pickedIds={pickedSet}
                        onPick={pick}
                        onMove={moveOne}
                      />
                    </>
                  )}
                </>
              )}
            </div>
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
            ) : pile === "important" && rows.length > 0 ? (
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
          preview={
            openRow
              ? { from: openRow.from, receivedAt: openRow.receivedAt, snippet: openRow.snippet }
              : undefined
          }
          onClose={closeMessage}
          previousId={openIndex > 0 ? messageIds[openIndex - 1] : undefined}
          nextId={openIndex >= 0 ? messageIds[openIndex + 1] : undefined}
          onNavigate={goToMessage}
          unread={openRow?.unread}
          inInbox={openRow?.inInbox}
          onAskAgentPanel={
            onOpenAgent && openId ? () => rpc.inbox.askAgent({ messageId: openId }) : undefined
          }
          onArchive={
            openRow?.inInbox
              ? () => {
                  // Back to the list, as Archive from the list does; the toast there offers Undo.
                  archive(openRow.id);
                  closeMessage();
                }
              : undefined
          }
          onMoveToInbox={
            openRow && !openRow.inInbox
              ? () => {
                  const { id, subject } = openRow;
                  patchRows((list) =>
                    list.map((row) => (row.id === id ? { ...row, inInbox: true } : row)),
                  );
                  setStatus({ kind: "moved", messageId: id, subject });
                  setError("");
                  const pending = (archiving.current.get(id) ?? Promise.resolve())
                    .then(() => rpc.inbox.unarchive({ messageId: id }))
                    .then(onRefreshed);
                  // Undo (an archive) waits for this move to finish.
                  archiving.current.set(
                    id,
                    pending.then(
                      () => true,
                      () => false,
                    ),
                  );
                  pending
                    .catch((cause) => setError(errorText(cause)))
                    .then(() => setReload((n) => n + 1));
                }
              : undefined
          }
          onRead={openRow ? (read) => setRead(openRow.id, read) : undefined}
          replyDoneText={
            openReplyTodo?.dueOn
              ? `${openReplyTodo.text} · ${dueLabel(openReplyTodo.dueOn, new Date())}`
              : openReplyTodo?.text
          }
          onReplyDone={
            openReplyTodo
              ? () =>
                  rpc.inbox.todos
                    .setDone({ id: openReplyTodo.id, done: true })
                    .then(changeTodo)
                    .catch((cause) => setError(errorText(cause)))
              : undefined
          }
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
    </div>
  );
}
