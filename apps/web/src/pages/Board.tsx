import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { Bot, Ticket, TicketComment, TicketPriority, TicketStatus } from "@rakazo/contracts";
import {
  TICKET_COMMENT_MAX_LENGTH,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TITLE_MAX_LENGTH,
} from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@rakazo/ui-web";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorNotice } from "../components/ErrorNotice";
import { PickFilter, SearchField } from "../components/ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { useListParams } from "../lib/list-params";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { useTicketPriorityLabels } from "../lib/ticket-priority";
import { useTicketStatusLabels } from "../lib/ticket-status";
import { errorText } from "../lib/user-error";
import { WindowChrome } from "./WindowChrome";

const BOARD_RECONNECT_BASE_MS = 1_000;
const BOARD_RECONNECT_MAX_MS = 30_000;

/** `embedded`: inside the app shell, which already gives the window chrome and navigation. */
export function BoardPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLingui();
  const list = useListParams([] as const, { field: "default", dir: "asc" });
  const query = list.param("q") ?? "";
  const ownerId = list.param("owner");
  const statuses = useTicketStatusLabels();
  const priorities = useTicketPriorityLabels();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [botsError, setBotsError] = useState("");
  const [movingTicketIds, setMovingTicketIds] = useState<string[]>([]);
  const [focusTicketId, setFocusTicketId] = useState("");
  const [focusMoveTriggerId, setFocusMoveTriggerId] = useState("");
  const [selected, setSelected] = useState<Ticket | "new" | null>(null);
  const [error, setError] = useState("");
  const errorSource = useRef<"tickets" | "move" | null>(null);
  const movingTicketIdsRef = useRef(new Set<string>());
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [commentRefresh, setCommentRefresh] = useState<Record<string, number>>({});
  const requestSequence = useRef(0);
  const appliedSequence = useRef(0);
  const botsRequestSequence = useRef(0);
  const reportTicketError = useCallback((cause: unknown) => {
    errorSource.current = "tickets";
    setError(errorText(cause));
  }, []);
  const clearPageError = useCallback(() => {
    errorSource.current = null;
    setError("");
  }, []);
  const clearMoveError = useCallback(() => {
    if (errorSource.current === "move") {
      errorSource.current = null;
      setError("");
    }
  }, []);
  const loadTickets = useCallback(
    async ({ clearError = true }: { clearError?: boolean } = {}) => {
      const sequence = ++requestSequence.current;
      const result = await rpc.tickets.list({});
      if (sequence >= appliedSequence.current) {
        appliedSequence.current = sequence;
        setTickets(result.tickets);
        if (clearError) clearPageError();
      }
    },
    [clearPageError],
  );
  const reload = useCallback(async () => {
    try {
      await loadTickets();
    } catch (cause) {
      reportTicketError(cause);
    }
  }, [loadTickets, reportTicketError]);
  async function moveTicket(id: string, status: TicketStatus) {
    if (movingTicketIdsRef.current.has(id)) return;
    movingTicketIdsRef.current.add(id);
    setMovingTicketIds((previous) => [...previous, id]);
    let writeSucceeded = false;
    try {
      await rpc.tickets.move({ id, status });
      writeSucceeded = true;
      await loadTickets({ clearError: false });
      clearMoveError();
      setFocusTicketId(id);
    } catch (cause) {
      if (writeSucceeded) reportTicketError(cause);
      else {
        errorSource.current = "move";
        setError(errorText(cause));
        setFocusMoveTriggerId(id);
      }
    } finally {
      movingTicketIdsRef.current.delete(id);
      setMovingTicketIds((previous) => previous.filter((ticketId) => ticketId !== id));
    }
  }

  useEffect(() => {
    if (!focusTicketId) return;
    const card = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-testid^='board-card-']"),
    ).find((element) => element.dataset.testid === `board-card-${focusTicketId}`);
    if (!card) return;
    card.focus();
    setFocusTicketId("");
  }, [focusTicketId, tickets]);

  useEffect(() => {
    if (!focusMoveTriggerId) return;
    document.getElementById(`board-move-${focusMoveTriggerId}`)?.focus();
    setFocusMoveTriggerId("");
  }, [focusMoveTriggerId, movingTicketIds]);

  useEffect(() => {
    let currentController: AbortController | undefined;
    let active = true;
    const refreshBots = async () => {
      const sequence = ++botsRequestSequence.current;
      try {
        const owners = await rpc.bots.list();
        if (active && sequence === botsRequestSequence.current) {
          setBots(owners);
          setBotsError("");
        }
      } catch (cause) {
        if (active && sequence === botsRequestSequence.current) setBotsError(errorText(cause));
      }
    };
    void refreshBots();
    void loadTickets()
      .catch((cause) => {
        if (active) reportTicketError(cause);
      })
      .finally(() => {
        if (active) setInitialLoadComplete(true);
      });
    let cancelRetry: (() => void) | undefined;
    let failures = 0;
    void (async () => {
      while (active) {
        const controller = new AbortController();
        let sawFrame = false;
        currentController = controller;
        try {
          const stream = await rpc.boards.subscribe(undefined, { signal: controller.signal });
          if (!active) return;
          void refreshBots();
          await loadTickets();
          if (!active) return;
          setCommentRefresh((previous) => ({
            ...previous,
            "*": (previous["*"] ?? 0) + 1,
          }));
          for await (const event of stream) {
            if (!active) return;
            sawFrame = true;
            setCommentRefresh((previous) => ({
              ...previous,
              [event.ticketId ?? "*"]: (previous[event.ticketId ?? "*"] ?? 0) + 1,
            }));
            await loadTickets();
          }
        } catch (cause) {
          if (active) reportTicketError(cause);
        } finally {
          controller.abort();
        }
        if (!active) return;
        failures = sawFrame ? 0 : failures + 1;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(
            resolve,
            Math.min(
              BOARD_RECONNECT_BASE_MS * 2 ** Math.max(failures - 1, 0),
              BOARD_RECONNECT_MAX_MS,
            ),
          );
          cancelRetry = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        cancelRetry = undefined;
      }
    })();
    return () => {
      active = false;
      currentController?.abort();
      cancelRetry?.();
    };
  }, [loadTickets, reportTicketError]);

  const ownerOptions: [string, string][] = [
    ["unassigned", t`Unassigned`],
    ...bots.map((bot) => [bot.id, bot.name] as [string, string]),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const shownTickets = tickets.filter((ticket) => {
    if (ownerId === "unassigned" && ticket.assigneeBotId) return false;
    if (ownerId && ownerId !== "unassigned" && ticket.assigneeBotId !== ownerId) return false;
    if (!normalizedQuery) return true;
    return [ticket.ref, ticket.title, ticket.description ?? ""].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    );
  });

  return (
    <div
      className={`flex min-w-0 flex-col overflow-hidden bg-background text-foreground ${
        embedded ? "min-h-0 flex-1" : "h-screen"
      }`}
    >
      {embedded ? null : <WindowChrome />}
      <div className={`${PAGE_GUTTER_X} flex items-start gap-2 pt-2`}>
        {embedded ? null : (
          <Button
            variant="ghost"
            size="icon"
            className="mt-1"
            render={<Link to="/app" />}
            aria-label={t`Back`}
          >
            <ChevronLeft />
          </Button>
        )}
        <PageHeader
          className="min-w-0 flex-1"
          title={<Trans>Task board</Trans>}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelected("new")}
              disabled={bots.length === 0}
            >
              <Trans>New ticket</Trans>
            </Button>
          }
        />
      </div>
      {error || botsError ? (
        <ErrorNotice message={error || botsError} className="px-4 py-2" />
      ) : null}
      <main
        className="@container relative min-h-0 min-w-0 flex-1 overflow-auto p-4 md:px-7"
        hidden={!initialLoadComplete}
      >
        {/* With no tickets, empty columns are noise and would crowd the explanation. */}
        {tickets.length === 0 && !error ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-1 px-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              <Trans>No tickets yet</Trans>
            </p>
            {bots.length > 0 ? (
              <p className="max-w-sm">
                <Trans>
                  Tickets track work for your bots. Bots add them when you ask them to track a task,
                  or press New ticket.
                </Trans>
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {tickets.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2" data-list-toolbar>
                <SearchField
                  className="w-full @md:w-72"
                  value={query}
                  onChange={(next) => list.setParam("q", next)}
                  placeholder={t`Search`}
                  label={t`Search`}
                  name="board-search"
                />
                <PickFilter
                  label={t`Owner`}
                  value={ownerId}
                  anyLabel={t`All`}
                  options={ownerOptions}
                  onChange={(next) => list.setParam("owner", next)}
                />
              </div>
            ) : null}
            {tickets.length > 0 && shownTickets.length === 0 ? (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Trans>No matches</Trans>
                <Button variant="ghost" size="sm" onClick={() => list.clear("q", "owner")}>
                  <Trans>Clear all</Trans>
                </Button>
              </div>
            ) : null}
            {/* Phones stack the columns; side by side they would need sideways scrolling. */}
            <div data-testid="board-columns" className="flex min-h-full flex-col gap-3 md:flex-row">
              {TICKET_STATUSES.map((status) => (
                <section key={status} className="flex-1 space-y-2 md:min-w-32">
                  <h2 className="px-1 text-sm font-medium">{statuses[status]}</h2>
                  {shownTickets
                    .filter((ticket) => ticket.status === status)
                    .map((ticket) => (
                      <div key={ticket.id} className="group relative">
                        <Button
                          data-testid={`board-card-${ticket.id}`}
                          variant="outline"
                          className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-3 text-left font-normal"
                          onClick={() => setSelected(ticket)}
                        >
                          <span className="pr-10 text-xs text-muted-foreground">
                            {ticket.priority === "high" || ticket.priority === "urgent"
                              ? `${ticket.ref} · ${priorities[ticket.priority]}`
                              : ticket.ref}
                          </span>
                          <span className="w-full pr-10">{ticket.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {bots.find((bot) => bot.id === ticket.assigneeBotId)?.name}
                          </span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 z-10 h-11 w-11 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-visible:opacity-100"
                                aria-label={t`Move to`}
                                id={`board-move-${ticket.id}`}
                                disabled={movingTicketIds.includes(ticket.id)}
                              />
                            }
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {TICKET_STATUSES.filter((value) => value !== ticket.status).map(
                              (value) => (
                                <DropdownMenuItem
                                  key={value}
                                  onClick={() => void moveTicket(ticket.id, value)}
                                >
                                  {statuses[value]}
                                </DropdownMenuItem>
                              ),
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                </section>
              ))}
            </div>
          </>
        )}
      </main>
      {selected ? (
        <TicketDialog
          key={selected === "new" ? "new" : selected.id}
          ticket={selected === "new" ? null : selected}
          bots={bots}
          commentRevision={
            (commentRefresh["*"] ?? 0) +
            (selected === "new" ? 0 : (commentRefresh[selected.id] ?? 0))
          }
          onClose={() => setSelected(null)}
          onSaved={async () => {
            clearPageError();
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TicketDialog({
  ticket,
  bots,
  onClose,
  onSaved,
  commentRevision,
}: {
  commentRevision?: number;
  ticket: Ticket | null;
  bots: Bot[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useLingui();
  const formId = useId();
  const statuses = useTicketStatusLabels();
  const priorities = useTicketPriorityLabels();
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [owner, setOwner] = useState(ticket ? (ticket.assigneeBotId ?? "") : (bots[0]?.id ?? ""));
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "todo");
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority ?? "normal");
  const [comments, setComments] = useState<TicketComment[]>([]);
  const commentRequestSequence = useRef(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticket) return;
    let active = true;
    const sequence = ++commentRequestSequence.current;
    void rpc.tickets
      .comments({ ticketId: ticket.id })
      .then((rows) => {
        if (active && sequence === commentRequestSequence.current) setComments(rows);
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, [ticket, commentRevision]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (ticket)
        await rpc.tickets.update({
          id: ticket.id,
          ...(title !== ticket.title ? { title } : {}),
          ...(description !== (ticket.description ?? "") ? { description } : {}),
          ...(owner && owner !== (ticket.assigneeBotId ?? "") ? { assigneeBotId: owner } : {}),
          ...(status !== ticket.status ? { status } : {}),
          ...(priority !== ticket.priority ? { priority } : {}),
        });
      else await rpc.tickets.create({ title, description, assigneeBotId: owner, priority });
      onClose();
      void onSaved();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  async function comment() {
    if (!ticket) return;
    setBusy(true);
    setError("");
    try {
      const row = await rpc.tickets.comment({ ticketId: ticket.id, body });
      commentRequestSequence.current += 1;
      setComments((previous) =>
        previous.some((commentRow) => commentRow.id === row.id) ? previous : [...previous, row],
      );
      setBody("");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket?.title ?? t`New ticket`}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label htmlFor={`${formId}-title`} className="block space-y-1 text-sm">
            <span>
              <Trans>Title</Trans>
            </span>
            <Input
              id={`${formId}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TICKET_TITLE_MAX_LENGTH}
              required
            />
          </label>
          <label htmlFor={`${formId}-description`} className="block space-y-1 text-sm">
            <span>
              <Trans>Description</Trans>
            </span>
            <Textarea
              id={`${formId}-description`}
              data-testid="ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={TICKET_DESCRIPTION_MAX_LENGTH}
            />
          </label>
          <label htmlFor={`${formId}-owner`} className="block space-y-1 text-sm">
            <span>
              <Trans>Owner</Trans>
            </span>
            <NativeSelect
              className="w-full"
              id={`${formId}-owner`}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              required={!ticket}
            >
              {ticket && !ticket.assigneeBotId ? (
                <NativeSelectOption value="">{t`Unassigned`}</NativeSelectOption>
              ) : null}
              {bots.map((bot) => (
                <NativeSelectOption key={bot.id} value={bot.id}>
                  {bot.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          {ticket ? (
            <label htmlFor={`${formId}-status`} className="block space-y-1 text-sm">
              <span>
                <Trans>Status</Trans>
              </span>
              <NativeSelect
                className="w-full"
                id={`${formId}-status`}
                value={status}
                onChange={(event) => setStatus(event.target.value as TicketStatus)}
              >
                {TICKET_STATUSES.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {statuses[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          <label htmlFor={`${formId}-priority`} className="block space-y-1 text-sm">
            <span>
              <Trans>Priority</Trans>
            </span>
            <NativeSelect
              className="w-full"
              id={`${formId}-priority`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
            >
              {TICKET_PRIORITIES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {priorities[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !title.trim() || (!ticket && !owner)}>
              {ticket ? t`Save` : t`Create`}
            </Button>
          </div>
        </form>
        {ticket ? (
          <div data-testid="ticket-comments" className="space-y-3 border-t pt-3">
            {comments.map((row) => (
              <div key={row.id} className="text-sm">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{row.authorName}</span>
                  <time dateTime={row.createdAt}>{formatRelativeTime(row.createdAt)}</time>
                </div>
                <ChatMarkdown>{row.body}</ChatMarkdown>
              </div>
            ))}
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void comment();
              }}
            >
              <Textarea
                aria-label={t`Comment`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={TICKET_COMMENT_MAX_LENGTH}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={busy || !body.trim()}>
                  <Trans>Comment</Trans>
                </Button>
              </div>
            </form>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
