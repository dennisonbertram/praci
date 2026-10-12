import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxTodo } from "@rakazo/contracts";
import { dueTone, localDaysUntil } from "@rakazo/core";
import { Card, Checkbox } from "@rakazo/ui-web";
import { useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** The open to-dos triage keeps; the page loads them with the list. Hidden when there is nothing to do. */
export function TodoCard({
  todos,
  onChange,
}: {
  todos: InboxTodo[];
  onChange: (todo: InboxTodo) => void;
}) {
  const { t, i18n: lingui } = useLingui();
  const [error, setError] = useState("");
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
