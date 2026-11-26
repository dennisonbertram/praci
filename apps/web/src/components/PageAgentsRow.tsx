import { useLingui } from "@lingui/react/macro";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@rakazo/ui-web";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { needsAnswerLabel } from "../lib/roster-status";
import { STICKY_GROUP_HEADER } from "./sticky-group-header";

/**
 * One folded row in the chat list: every page and integration agent, or every email chat. Each page already opens
 * its agent with Ask, so the agents stay folded; a dot shows when any of them needs the person.
 */
export function PageAgentsRow({
  label,
  testId = "sidebar-page-agents",
  rosterId,
  open,
  count,
  needsYou,
  heldFor,
  belowHeading,
  onToggle,
  actions,
}: {
  /** The row's name; defaults to "Page agents". */
  label?: string;
  testId?: string;
  /** Unique across the sidebar; makes the row an arrow-key stop like chats. */
  rosterId?: string;
  open: boolean;
  count: number;
  needsYou: boolean;
  /** Set when a run is held for the owner; other reasons for the dot read "New". */
  heldFor?: "answer" | "takeover" | null;
  /** The group's own pinned heading sits above this row: stop just under it instead of covering it. */
  belowHeading?: boolean;
  onToggle: () => void;
  /** Menu items for the row's "…" menu; no menu when left out. */
  actions?: ReactNode;
}) {
  const { t } = useLingui();
  const rowRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const name = label ?? t`Page agents`;
  const menuLabel = t`Actions for ${name}`;
  return (
    <div
      data-roster-item={rosterId}
      className={`group/fold relative mb-1 ${open ? `${STICKY_GROUP_HEADER} ${belowHeading ? "top-10.5" : "top-0"}` : ""}`}
    >
      <button
        type="button"
        data-testid={testId}
        data-roster-fold=""
        data-roster-row={rosterId}
        aria-expanded={open}
        ref={rowRef}
        onClick={() => {
          // Opening adds rows below the fold, behind the "+N more" bar: put this header at the top so they show.
          // Done on the click, not on `open`, because one open flag is shared by every space's row.
          if (!open) rowRef.current?.scrollIntoView?.({ block: "start" });
          onToggle();
        }}
        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-start text-[13px] font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{name}</span>
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
        {count > 0 ? (
          <span
            className={`text-[12px] tabular-nums ${
              actions
                ? menuOpen
                  ? "pointer-fine:opacity-0"
                  : "group-hover/fold:pointer-fine:opacity-0"
                : ""
            }`}
          >
            {count}
          </span>
        ) : null}
      </button>
      {actions ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                data-roster-actions=""
                variant="ghost"
                size="icon-sm"
                aria-label={menuLabel}
                className={`absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/fold:opacity-100 pointer-coarse:hidden ${
                  menuOpen ? "opacity-100" : ""
                }`}
              />
            }
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label={menuLabel} className="w-[220px]">
            {actions}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
