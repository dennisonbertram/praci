import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxTodo } from "@rakazo/contracts";
import { dueTone, localDaysUntil } from "@rakazo/core";
import { Button, Card, Checkbox } from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Shimmer } from "../ai/primitives";

/** "Today", "Tomorrow", a short weekday within the week, otherwise a short date; shared by the card, mail rows and the open mail. */
export function dueLabel(dueOn: string, now: Date) {
  const days = localDaysUntil(dueOn, now);
  if (days === 0) return t`Today`;
  if (days === 1) return t`Tomorrow`;
  const [year = 0, month = 1, day = 1] = dueOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    i18n.locale || "en",
    days > 0 && days <= 6
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric" },
  );
}

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
  // With open to-dos the card is one line (heading and count) until opened, so the first mail
  // starts high on the screen and a task already shown on a mail row is not written out twice.
  const collapsed = !expanded && openCount > 0;
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
      <h2 id="inbox-todo-heading" className="text-xs font-semibold text-muted-foreground">
        {openCount > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-sm px-1 py-1.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Trans>To do</Trans>
            <span className="tabular-nums">{openCount}</span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`ms-auto transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <Trans>To do</Trans>
        )}
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
          // Ticked to-dos stay struck through until the next visit.
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
                  // On touch the control itself is 44 px (drawn as a 16 px box inside it); negative margins keep the row height.
                  className="mt-0.5 border-muted-foreground pointer-coarse:-mx-3 pointer-coarse:-my-3 pointer-coarse:mt-[-0.625rem] pointer-coarse:size-11 pointer-coarse:border-transparent pointer-coarse:bg-transparent pointer-coarse:data-checked:bg-transparent pointer-coarse:dark:bg-transparent pointer-coarse:after:hidden pointer-coarse:before:absolute pointer-coarse:before:size-4 pointer-coarse:before:rounded-[4px] pointer-coarse:before:border pointer-coarse:before:border-muted-foreground pointer-coarse:data-checked:before:border-primary pointer-coarse:data-checked:before:bg-primary pointer-coarse:[&>[data-slot=checkbox-indicator]]:relative"
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
                    className={`whitespace-nowrap text-xs ${tone === "crit" && days < 0 ? "text-destructive" : tone !== "none" ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {dueLabel(todo.dueOn, now)}
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
    </Card>
  );
}
