import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxListOutput, InboxMark, MailRow } from "@rakazo/contracts";
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
import { useSearchParams } from "react-router-dom";
import { InboxConsentPrompt } from "../components/AiDataSharing";
import { ComposeEmail, MAIL_SENT_EVENT, NEW_MESSAGE } from "../components/ComposeEmail";
import { InboxMessageDialog } from "../components/inbox/InboxMessageDialog";
import { InboxGroup } from "../components/inbox/InboxRow";
import { TodoCard } from "../components/inbox/TodoCard";
import {
  inboxListInput,
  MAX_QUERY,
  readInboxListState,
  setInboxListParam,
} from "../lib/inbox-list-input";
import { syncErrorText } from "../lib/inbox-sync-error";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const ALL = "all";
// ponytail: bounded polling while triage runs; add a user-level event if it often takes longer than 30 seconds.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 6;

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
  const keyRef = useRef(listKey);
  keyRef.current = listKey;
  // Pages after the first of a filtered or searched list, which Gmail pages for us.
  const [more, setMore] = useState<{ rows: MailRow[]; token?: string; busy: boolean }>({
    rows: [],
    busy: false,
  });
  const [error, setError] = useState("");
  // The last mark the user made, kept so it can be undone even after the row left the list.
  const [marked, setMarked] = useState<{ messageId: string; mark: InboxMark } | null>(null);
  const [synced, setSynced] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const polls = useRef(0);
  const [composing, setComposing] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);

  // A message sent from any composer: say so briefly and reload, since the send synced the account.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSent = () => {
      setSentNotice(true);
      setReload((n) => n + 1);
      onRefreshed();
      clearTimeout(timer);
      timer = setTimeout(() => setSentNotice(false), 4_000);
    };
    window.addEventListener(MAIL_SENT_EVENT, onSent);
    return () => {
      window.removeEventListener(MAIL_SENT_EVENT, onSent);
      clearTimeout(timer);
    };
  }, [onRefreshed]);

  useEffect(() => {
    if (paused) return;
    let live = true;
    rpc.inbox
      .list(inboxListInput(listState, tab))
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
  }, [tab, filter, query, view, category, reload, paused]);

  useEffect(() => setDraft(query), [query]);
  useEffect(() => setMarked(null), [listKey]);

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
  const failed = error || (data ? syncErrorText(data) : "");
  const loading = !data || dataKey !== listKey || (!filtered && data.rows.length === 0 && !synced);
  const retry = () => {
    setError("");
    setAttempt((n) => n + 1);
    setReload((n) => n + 1);
  };
  const setParam = (name: Parameters<typeof setInboxListParam>[1], value: string) =>
    setParams(setInboxListParam(params, name, value));
  // The view and category buttons show only when triage can fill them in.
  const triage = Boolean(data?.enabled);
  const narrowed = triage && (view === "important" || Boolean(category));
  const mark = (messageId: string, value: InboxMark | null) => {
    setError("");
    rpc.inbox
      .feedback({ messageId, mark: value })
      .then(() => {
        setMarked(value ? { messageId, mark: value } : null);
        setReload((n) => n + 1);
      })
      .catch((cause) => setError(errorText(cause)));
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
  const openMessage = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("mail", id);
    setParams(next);
  };
  const closeMessage = () => {
    const next = new URLSearchParams(params);
    next.delete("mail");
    setParams(next, { replace: true });
  };
  const openRow = [...(data?.rows ?? []), ...more.rows].find((row) => row.id === openId);

  return (
    <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="me-1 shrink-0 text-lg font-medium">
          <Trans>Inbox</Trans>
        </h1>
        <form
          className="min-w-0 flex-1"
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

      {sentNotice ? (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          <Trans>Sent</Trans>
        </p>
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
      ) : data && data.rows.length === 0 ? (
        failed ? null : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            <Trans>No mail</Trans>
          </p>
        )
      ) : (
        <>
          {filtered || narrowed ? null : data.triageBlocked?.reason === "needs_consent" ? (
            // Allowing syncs again, which is what queues triage now that it may run.
            <InboxConsentPrompt
              recipient={data.triageBlocked.recipient}
              onAllowed={() => {
                setAttempt((n) => n + 1);
                setReload((n) => n + 1);
              }}
            />
          ) : (
            <TodoCard connectionId={tab} list={data} paused={paused} />
          )}
          {marked ? (
            <p role="status" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              {marked.mark === "noise" ? (
                <Trans>Marked noise</Trans>
              ) : (
                <Trans>Marked important</Trans>
              )}
              <Button variant="ghost" size="sm" onClick={() => mark(marked.messageId, null)}>
                <Trans>Undo</Trans>
              </Button>
            </p>
          ) : null}
          <InboxGroup
            title={<Trans>Needs reply</Trans>}
            rows={groups.needsReply}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
            today={false}
          />
          <InboxGroup
            title={<Trans>Today</Trans>}
            rows={groups.today}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
            today
          />
          <InboxGroup
            title={<Trans>Earlier</Trans>}
            rows={groups.earlier}
            onOpen={openMessage}
            onMark={triage ? mark : undefined}
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
      <InboxMessageDialog messageId={openId} subject={openRow?.subject} onClose={closeMessage} />
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
