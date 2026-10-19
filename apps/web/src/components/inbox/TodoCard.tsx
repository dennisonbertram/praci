import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxTodo } from "@rakazo/contracts";
import { dueTone, localDaysUntil } from "@rakazo/core";
import { Button, Card, Checkbox } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

const COLLAPSED_OPEN = 2;
// A ticked to-do shows its strike-through, then fades and collapses, then leaves the list.
const STRIKE_MS = 400;
const FADE_MS = 1100;
const REDUCED_MOTION_MS = 300;

/** The open to-dos triage keeps; the page loads them with the list. Hidden when there is nothing to do. */
export function TodoCard({
  todos,
  onChange,
  onOpen,
}: {
  todos: InboxTodo[];
  onChange: (todo: InboxTodo) => void;
  /** Opens the email a to-do came from. */
  onOpen?: (messageId: string) => void;
}) {
  const { t, i18n: lingui } = useLingui();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  // Done to-dos sort last by their state when first shown, so ticking one leaves it in place.
  const doneWhenShown = useRef(new Map<string, boolean>());
  // Ticked to-dos mid-fade, and those that finished fading and left the list.
  const [fading, setFading] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const wasOpen = useRef(new Set<string>());
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  useEffect(() => {
    const swap = (set: ReadonlySet<string>, id: string, on: boolean) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    };
    for (const todo of todos) {
      const pending = timers.current.get(todo.id);
      if (todo.doneAt === null) {
        // Unticking before the fade ends cancels it.
        wasOpen.current.add(todo.id);
        if (pending) clearTimeout(pending);
        timers.current.delete(todo.id);
        setFading((set) => (set.has(todo.id) ? swap(set, todo.id, false) : set));
        setGone((set) => (set.has(todo.id) ? swap(set, todo.id, false) : set));
      } else if (!pending && wasOpen.current.has(todo.id)) {
        const instant = reduced();
        if (!instant) setFading((set) => swap(set, todo.id, true));
        timers.current.set(
          todo.id,
          setTimeout(
            () => {
              wasOpen.current.delete(todo.id);
              timers.current.delete(todo.id);
              setFading((set) => swap(set, todo.id, false));
              setGone((set) => swap(set, todo.id, true));
            },
            instant ? REDUCED_MOTION_MS : STRIKE_MS + FADE_MS,
          ),
        );
      }
    }
  }, [todos]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);
  const visible = todos.filter((todo) => !(gone.has(todo.id) && todo.doneAt !== null));
  if (visible.length === 0) return null;
  for (const todo of todos)
    if (!doneWhenShown.current.has(todo.id))
      doneWhenShown.current.set(todo.id, todo.doneAt !== null);
  const now = new Date();
  const ordered = [...visible].sort(
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
          // Narrow containers show only the first few open to-dos until expanded.
          const collapsed = isCollapsed(todo, index);
          const fadingOut = fading.has(todo.id);
          return (
            <li
              key={todo.id}
              className={`border-t border-border first:border-t-0 ${collapsed ? "hidden @3xl:grid" : "grid"} ${fadingOut ? "grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] delay-[400ms] duration-[1100ms] ease-in" : "grid-rows-[1fr]"}`}
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
      {hiddenCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="@3xl:hidden self-start text-muted-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Trans>Show less</Trans> : <Trans>{hiddenCount} more</Trans>}
        </Button>
      ) : null}
    </Card>
  );
}
