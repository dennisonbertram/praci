import { t } from "@lingui/core/macro";
import { cn } from "@rakazo/ui-web";
import { Folder } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { FolderNode } from "./folders";

/** The folder list. Arrow keys move between entries; Enter or Space opens one. */
export function FolderTree({
  nodes,
  selected,
  onSelect,
}: {
  nodes: FolderNode[];
  /** Undefined is every folder. */
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const entries = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[role=treeitem]"),
    );
    const next =
      entries[
        entries.indexOf(document.activeElement as HTMLElement) +
          (event.key === "ArrowDown" ? 1 : -1)
      ];
    next?.focus();
  }
  const entry = (id: string | undefined, name: string, depth: number) => (
    <div
      key={id ?? "all"}
      role="treeitem"
      tabIndex={0}
      aria-level={depth + 1}
      aria-selected={selected === id}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      }}
      style={{ paddingInlineStart: `${8 + depth * 16}px` }}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pe-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        selected === id && "bg-sidebar-accent font-semibold",
      )}
    >
      <Folder aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate" title={name}>
        {name}
      </span>
    </div>
  );
  return (
    <div
      role="tree"
      aria-label={t`Folders`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-e border-border p-2"
    >
      {entry(undefined, t`All items`, 0)}
      {nodes.map(({ folder, depth }) => entry(folder.id, folder.name, depth))}
    </div>
  );
}
