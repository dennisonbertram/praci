import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxTodo } from "@rakazo/contracts";
import { dueTone, localDaysUntil } from "@rakazo/core";
import { Button, Card, Checkbox } from "@rakazo/ui-web";
import { useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Shimmer } from "../ai/primitives";

const COLLAPSED_OPEN = 2;

/** The open to-dos triage keeps; the page loads them with the list. Hidden when there are none. */
export function TodoCard({
  todos,
  onChange,
  onOpen,
  meetings,
}: {
  todos: InboxTodo[];
  onChange: (todo: InboxTodo) => void;
  /** Opens the email a to-do came from. */
  onOpen?: (messageId: string) => void;
  /** The user's meeting source, from the list reply; adds the Syncing and empty lines. */
  meetings?: { source: boolean; syncing: boolean; ready: boolean };
}) {
  const { t, i18n: lingui } = useLingui();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  // Done to-dos sort last by their state when first shown, so ticking one leaves it in place.
  const doneWhenShown = useRef(new Map<string, boolean>());
  const syncing = Boolean(meetings?.source && meetings.syncing);
  const openCount = todos.filter((todo) => todo.doneAt === null).length;
  // The first sync decides nothing yet; afterwards a connected source with consent and no open to-do says so.
  const noFollowUps =
    Boolean(meetings?.source && meetings.ready && !meetings.syncing) && openCount === 0;
  if (todos.length === 0 && !syncing && !noFollowUps) return null;
  for (const todo of todos)
    if (!doneWhenShown.current.has(todo.id))
      doneWhenShown.current.set(todo.id, todo.doneAt !== null);
  const now = new Date();
  const ordered = [...todos].sort(
    (a, b) => Number(doneWhenShown.current.get(a.id)) - Number(doneWhenShown.current.get(b.id)),
  );
  const isCollapsed = (todo: InboxTodo, index: number) =>
    !expanded && todo.doneAt === null && index >= COLLAPSED_OPEN;
  const hiddenCount = ordered.filter(
    (todo, index) => todo.doneAt === null && index >= COLLAPSED_OPEN,
  ).length;
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
      .then(onChange)
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
        {ordered.map((todo, index) => {
          const days = todo.dueOn ? localDaysUntil(todo.dueOn, now) : null;
          const tone = dueTone(days, todo.priority);
          const done = todo.doneAt !== null;
          // Only the first few open to-dos show until expanded; ticked ones stay struck through until the next visit.
          const collapsed = isCollapsed(todo, index);
          return (
            <li
              key={todo.id}
              className={`border-t border-border first:border-t-0 ${collapsed ? "hidden" : "grid"}`}
            >
              <div className="flex min-h-0 items-start gap-2.5 overflow-hidden py-1.5">
                <Checkbox
                  aria-label={todo.text}
                  checked={done}
                  onCheckedChange={(checked) => setDone(todo, checked)}
                  className="mt-0.5 border-muted-foreground pointer-coarse:size-5"
                />
                <div
                  dir="auto"
                  className={`min-w-0 flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}
                >
                  {todo.messageId && onOpen ? (
                    <Button
                      variant="link"
                      aria-haspopup="dialog"
                      // A button does not inherit the strike-through, so it carries its own.
                      className={`h-auto whitespace-normal rounded-sm p-0 text-start text-sm font-normal text-foreground hover:underline ${done ? "text-muted-foreground line-through" : ""}`}
                      onClick={() => todo.messageId && onOpen(todo.messageId)}
                    >
                      {todo.text}
                    </Button>
                  ) : (
                    todo.text
                  )}
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
              </div>
            </li>
          );
        })}
      </ul>
      {syncing ? (
        <p role="status" className="py-1.5 text-sm">
          <Shimmer>
            <Trans>Syncing</Trans>
          </Shimmer>
        </p>
      ) : null}
      {noFollowUps ? (
        <p className="py-1.5 text-sm text-muted-foreground">
          <Trans>No follow-ups from meetings yet</Trans>
        </p>
      ) : null}
      {hiddenCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Trans>Show less</Trans> : <Trans>{hiddenCount} more</Trans>}
        </Button>
      ) : null}
    </Card>
  );
}
