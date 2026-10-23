import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder } from "@rakazo/contracts";
import { Button, cn } from "@rakazo/ui-web";
import { Folder, FolderPlus, WandSparkles } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { PAGE_GUTTER_START } from "../PageHeader";
import type { FolderNode } from "./folders";
import type { ItemAction } from "./ItemMenu";
import { ItemMenu } from "./ItemMenu";

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
  onAutoSort,
}: {
  nodes: FolderNode[];
  /** Undefined is every folder. */
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  onAction?: (action: ItemAction, folder: DataRoomApiFolder) => void;
  onNewFolder?: () => void;
  onAutoSort?: () => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  // Keeps the open folder clear of the footer below the list, only when the selection changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selected is the trigger
  useEffect(() => {
    list.current?.querySelector("[aria-selected=true]")?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
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
  const entry = (folder: DataRoomApiFolder | undefined, depth: number, parent = false) => {
    const id = folder?.id;
    const name = folder?.name ?? t`All items`;
    return (
      <div
        key={id ?? "all"}
        role="treeitem"
        tabIndex={stop === id ? 0 : -1}
        aria-level={depth + 1}
        aria-selected={selected === id}
        // The tree is always open, so a folder with subfolders is expanded.
        aria-expanded={parent ? true : undefined}
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
          selected === id && "bg-sidebar-accent font-medium",
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
    <div className={cn("flex w-full min-w-0 flex-col", PAGE_GUTTER_START)}>
      <div
        ref={list}
        role="tree"
        aria-label={t`Folders`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-2 pe-2"
      >
        {entry(undefined, 0, nodes.length > 0)}
        {nodes.map(({ folder, depth }, n) =>
          entry(folder, depth, (nodes[n + 1]?.depth ?? 0) > depth),
        )}
      </div>
      {onNewFolder || onAutoSort ? (
        <div className="flex flex-col border-t border-border py-2 pe-2">
          {onNewFolder ? (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-8 w-full justify-start gap-2 ps-2 text-sm font-normal text-muted-foreground"
              onClick={onNewFolder}
            >
              <FolderPlus aria-hidden="true" className="size-3.5" />
              <Trans>New folder</Trans>
            </Button>
          ) : null}
          {onAutoSort ? (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-8 w-full justify-start gap-2 ps-2 text-sm font-normal text-muted-foreground"
              onClick={onAutoSort}
            >
              <WandSparkles aria-hidden="true" className="size-3.5" />
              <Trans>Auto-sort</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
