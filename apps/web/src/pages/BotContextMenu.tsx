import { useLingui } from "@lingui/react/macro";
import type { Bot, BotSection } from "@rakazo/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import {
  Archive,
  Bell,
  BellDot,
  Check,
  Copy,
  Eraser,
  Folder,
  FolderPlus,
  Pencil,
  Pin,
  Repeat,
  Trash2,
} from "lucide-react";

export type ContextMenuPosition = { x: number; y: number };

type ChatMenuTarget = Pick<Bot, "name" | "pinned" | "sectionId" | "unread">;

export function BotContextMenu({
  bot,
  position,
  onClose,
  onTogglePinned,
  sections,
  onMoveToSection,
  onCreateSection,
  onRenameSection,
  onToggleUnread,
  isGroup = false,
  onRoutines,
  onEdit,
  onDuplicate,
  onClear,
  onArchive,
  onDelete,
}: {
  bot: ChatMenuTarget;
  position: ContextMenuPosition;
  onClose: () => void;
  onTogglePinned: () => void;
  sections: BotSection[];
  onMoveToSection: (sectionId: string | null) => void;
  onCreateSection: () => void;
  onRenameSection?: (sectionId: string) => void;
  onToggleUnread: () => void;
  /** Groups have settings, not a profile, and no routines. */
  isGroup?: boolean;
  onRoutines?: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  /** Only for a group, which has no settings panel; a bot clears its conversation there. */
  onClear?: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useLingui();

  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Invisible anchor at the pointer position; the menu itself carries the accessible name. */}
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="fixed size-0 p-0 opacity-0"
            style={{ left: position.x, top: position.y }}
          />
        }
      />
      <DropdownMenuContent
        aria-label={t`Actions for ${bot.name}`}
        align="start"
        sideOffset={0}
        className="max-h-[min(420px,calc(100vh-16px))] w-[264px] overflow-y-auto"
      >
        <DropdownMenuItem onClick={onTogglePinned}>
          <Pin />
          {bot.pinned ? t`Unpin` : t`Pin`}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Folder />
            {t`Move to`}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[min(420px,calc(100vh-16px))] min-w-[180px] overflow-y-auto">
            {sections.map((section) => (
              <DropdownMenuItem key={section.id} onClick={() => onMoveToSection(section.id)}>
                <Folder />
                <span dir="auto">{section.name}</span>
                {bot.sectionId === section.id ? <Check className="ms-auto" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => onMoveToSection(null)}>
              <Folder />
              {t`No folder`}
              {bot.sectionId === null ? <Check className="ms-auto" /> : null}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateSection}>
              <FolderPlus />
              {t`New folder`}
            </DropdownMenuItem>
            {bot.sectionId && onRenameSection ? (
              <DropdownMenuItem onClick={() => onRenameSection(bot.sectionId!)}>
                <Pencil />
                {t`Rename`}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onToggleUnread}>
          {bot.unread ? <BellDot /> : <Bell />}
          {bot.unread ? t`Mark as read` : t`Mark as unread`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          {isGroup ? t`Group settings` : t`Bot settings`}
        </DropdownMenuItem>
        {onRoutines && !isGroup ? (
          <DropdownMenuItem onClick={onRoutines}>
            <Repeat />
            {t`Routines`}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          {t`Duplicate`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {onClear ? (
          <DropdownMenuItem onClick={onClear}>
            <Eraser />
            {t`Clear conversation`}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onArchive}>
          <Archive />
          {t`Archive`}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          {t`Delete`}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
