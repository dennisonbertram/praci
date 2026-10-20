import { useLingui } from "@lingui/react/macro";
import type { NotificationKind } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@rakazo/ui-web";
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { StatusMark } from "../sidebar-glance";
import { useFolderDnd } from "./SidebarDnd";

/**
 * A folder row in the Personnel list: chevron, name, how many chats it holds, and a menu. While
 * collapsed it still shows the most urgent status of the chats inside (or an unread dot), so
 * nothing is hidden.
 */
export function FolderHeader({
  id,
  name,
  count,
  collapsed,
  status,
  unread,
  editing,
  readOnly,
  onToggle,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  id: string;
  name: string;
  count: number;
  collapsed: boolean;
  /** The most urgent status among the chats inside. */
  status?: NotificationKind;
  /** A chat inside is unread. */
  unread?: boolean;
  editing: boolean;
  /** Another space's folder: it opens and closes, but cannot be moved or changed here. */
  readOnly?: boolean;
  onToggle: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const dnd = useFolderDnd(id, readOnly || editing);
  const actions = t`Actions for ${name}`;
  return (
    <div
      ref={dnd?.setNodeRef}
      data-sidebar-folder={id}
      data-drop-into={dnd?.dropsInto ? "" : undefined}
      className={`group/folder relative mt-1 flex items-center rounded-lg ${
        dnd?.isDragging ? "opacity-50" : ""
      } ${dnd?.dropsFolder ? "border-t-2 border-ring" : ""} data-drop-into:bg-sidebar-accent data-drop-into:ring-2 data-drop-into:ring-ring`}
    >
      {editing ? (
        <FolderNameInput name={name} onSubmit={onRename} onCancel={onCancelRename} />
      ) : (
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t`Expand ${name}` : t`Collapse ${name}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-start text-[13px] font-medium text-foreground/80 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={onToggle}
          {...dnd?.handleProps}
        >
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            className={`shrink-0 transition-transform motion-reduce:transition-none ${
              collapsed ? "-rotate-90" : ""
            }`}
            aria-hidden="true"
          />
          <span dir="auto" className="min-w-0 truncate" title={name}>
            {name}
          </span>
          <span
            className={`ms-auto flex shrink-0 items-center gap-1.5 ${
              menuOpen ? "pointer-fine:opacity-0" : "group-hover/folder:pointer-fine:opacity-0"
            }`}
          >
            {collapsed && status ? <StatusMark kind={status} botId={id} /> : null}
            {collapsed && !status && unread ? (
              <span
                data-testid="folder-unread"
                aria-hidden="true"
                className="inline-block size-2 rounded-full bg-foreground"
              />
            ) : null}
            <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
          </span>
        </button>
      )}
      {editing || readOnly ? null : (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={actions}
                className={`absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/folder:opacity-100 pointer-coarse:hidden ${
                  menuOpen ? "opacity-100" : ""
                }`}
              />
            }
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label={actions} className="w-[200px]">
            <DropdownMenuItem onClick={onStartRename}>
              <Pencil />
              {t`Rename`}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {t`Delete folder`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Edits the name in place: Enter or leaving the field saves, Escape cancels. */
function FolderNameInput({
  name,
  onSubmit,
  onCancel,
}: {
  name: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  // Enter and the blur it causes both save; only the first counts.
  const [done, setDone] = useState(false);
  // The menu that opened this field returns focus to its button as it closes; take it back.
  const openedAt = useRef(performance.now());
  const finish = (value: string) => {
    if (done) return;
    setDone(true);
    const next = value.trim();
    if (!next || next === name) onCancel();
    else onSubmit(next);
  };
  return (
    <Input
      autoFocus
      defaultValue={name}
      maxLength={60}
      aria-label={t`Rename`}
      className="mx-1 h-7 flex-1 text-[13px]"
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        if (performance.now() - openedAt.current < 300) event.currentTarget.focus();
        else finish(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(event.currentTarget.value);
        if (event.key === "Escape") {
          setDone(true);
          onCancel();
        }
      }}
    />
  );
}
