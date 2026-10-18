import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder } from "@rakazo/contracts";
import { Button, cn } from "@rakazo/ui-web";
import { Folder, FolderPlus } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import type { FolderNode } from "./folders";
import { type ItemAction, ItemMenu } from "./ItemMenu";

/**
 * The folder list. It is one Tab stop: arrow keys move between entries, Enter or Space opens one.
 * Every folder has Move, Rename and Delete in its "…" menu, which a right-click (or the context-menu
 * key) also opens.
 */
export function FolderTree({
  nodes,
  selected,
  onSelect,
  onAction,
  onNewFolder,
}: {
  nodes: FolderNode[];
  /** Undefined is every folder. */
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  onAction?: (action: ItemAction, folder: DataRoomApiFolder) => void;
  onNewFolder?: () => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // The selected entry is the Tab stop; All items when the selection is not in the list.
  const stop = nodes.some(({ folder }) => folder.id === selected) ? selected : undefined;
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
  const entry = (folder: DataRoomApiFolder | undefined, depth: number) => {
    const id = folder?.id;
    const name = folder?.name ?? t`All items`;
    return (
      <div
        key={id ?? "all"}
        role="treeitem"
        tabIndex={stop === id ? 0 : -1}
        aria-level={depth + 1}
        aria-selected={selected === id}
        onClick={() => onSelect(id)}
        onContextMenu={(event) => {
          if (!folder || !onAction) return;
          event.preventDefault();
          setMenuFor(folder.id);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(id);
          } else if (
            folder &&
            onAction &&
            (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))
          ) {
            event.preventDefault();
            setMenuFor(folder.id);
          }
        }}
        style={{ paddingInlineStart: `${8 + depth * 16}px` }}
        className={cn(
          "group flex min-h-8 cursor-pointer items-center gap-2 rounded-lg pe-1 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          selected === id && "bg-sidebar-accent font-semibold",
        )}
      >
        <Folder aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate" title={name}>
          {name}
        </span>
        {folder && onAction ? (
          <ItemMenu
            item={folder}
            onAction={onAction}
            open={menuFor === folder.id}
            onOpenChange={(open) => setMenuFor(open ? folder.id : null)}
            triggerTabIndex={-1}
            // Shown on hover, focus or while open; always on touch screens, which have no hover.
            className="size-6 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
          />
        ) : null}
      </div>
    );
  };
  return (
    <div className="flex w-56 shrink-0 flex-col border-e border-border">
      <div
        role="tree"
        aria-label={t`Folders`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {entry(undefined, 0)}
        {nodes.map(({ folder, depth }) => entry(folder, depth))}
      </div>
      {onNewFolder ? (
        <div className="p-2 pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onNewFolder}
          >
            <FolderPlus aria-hidden="true" />
            <Trans>New folder</Trans>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
