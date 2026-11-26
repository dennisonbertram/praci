import { localDaysUntil } from "@rakazo/core";

/** Inline lists show this many rows; the rest open behind "See all". */
export const INLINE_CAP = 3;

export function capItems<T>(items: readonly T[], cap = INLINE_CAP) {
  return { shown: items.slice(0, cap), total: items.length, capped: items.length > cap };
}

/** Case-insensitive match of the query against every searchable field. */
export function searchItems<T>(items: readonly T[], query: string, fields: (item: T) => string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) => fields(item).some((f) => f.toLowerCase().includes(needle)));
}

export type DueFilter = "all" | "overdue" | "upcoming" | "none";

/** To-dos with the earliest due date first; undated ones last. */
export function filterTodosByDue<T extends { dueOn: string | null }>(
  todos: readonly T[],
  filter: DueFilter,
  now = new Date(),
) {
  const kept = todos.filter((todo) => {
    if (filter === "all") return true;
    if (!todo.dueOn) return filter === "none";
    const days = localDaysUntil(todo.dueOn, now);
    return filter === "overdue" ? days < 0 : filter === "upcoming" && days >= 0;
  });
  return kept.sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
}
