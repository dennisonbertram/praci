import { useLingui } from "@lingui/react/macro";
import { ChevronDown } from "lucide-react";

/**
 * One row that holds every page and integration agent in the chat list. Each page already opens
 * its agent with Ask, so the agents stay folded; a dot shows when any of them needs the person.
 */
export function PageAgentsRow({
  open,
  count,
  needsYou,
  onToggle,
}: {
  open: boolean;
  count: number;
  needsYou: boolean;
  onToggle: () => void;
}) {
  const { t } = useLingui();
  return (
    <button
      type="button"
      data-testid="sidebar-page-agents"
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
      <span className="min-w-0 flex-1 truncate">{t`Page agents`}</span>
      {needsYou ? (
        <span
          data-testid="page-agents-dot"
          role="img"
          aria-label={t`Needs you`}
          className="size-2 shrink-0 rounded-full bg-primary"
        />
      ) : null}
      <span className="text-[12px] tabular-nums">{count}</span>
    </button>
  );
}
