import { useLingui } from "@lingui/react/macro";
import { ChevronDown } from "lucide-react";
import { needsAnswerLabel } from "../lib/roster-status";

/**
 * One folded row in the chat list: every page and integration agent, or every email chat. Each page already opens
 * its agent with Ask, so the agents stay folded; a dot shows when any of them needs the person.
 */
export function PageAgentsRow({
  label,
  testId = "sidebar-page-agents",
  open,
  count,
  needsYou,
  heldFor,
  onToggle,
}: {
  /** The row's name; defaults to "Page agents". */
  label?: string;
  testId?: string;
  open: boolean;
  count: number;
  needsYou: boolean;
  /** Set when a run is held for the owner; other reasons for the dot read "New". */
  heldFor?: "answer" | "takeover" | null;
  onToggle: () => void;
}) {
  const { t } = useLingui();
  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={open}
      onClick={onToggle}
      className="mb-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-start text-[13px] font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronDown
        size={14}
        strokeWidth={1.8}
        className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{label ?? t`Page agents`}</span>
      {needsYou ? (
        <span
          data-testid="page-agents-dot"
          role="img"
          aria-label={
            heldFor === "answer"
              ? needsAnswerLabel()
              : heldFor === "takeover"
                ? t`Needs takeover`
                : t`New`
          }
          className="size-2 shrink-0 rounded-full bg-primary"
        />
      ) : null}
      <span className="text-[12px] tabular-nums">{count}</span>
    </button>
  );
}
