import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { FolderInput, MoreHorizontal, Pencil, RotateCw, Trash2 } from "lucide-react";
import type { ElementType } from "react";
import { type SendTarget, SendToAgentMenu } from "./SendToAgent";

export type ItemAction = "move" | "rename" | "delete" | "retry";

const PARTS = {
  dropdown: { Item: DropdownMenuItem, Separator: DropdownMenuSeparator },
  context: { Item: ContextMenuItem, Separator: ContextMenuSeparator },
} satisfies Record<string, Record<string, ElementType>>;

/**
 * The actions for one item or folder, shared by the "..." dropdown and the right-click menu: Send
 * to agent (files with agents), Move, Rename and Delete, led by Try again for a file that failed.
 */
export function ItemMenuItems<T extends { name: string }>({
  menu,
  item,
  onAction,
  canRetry = false,
  agents,
  onSendToAgent,
}: {
  menu: keyof typeof PARTS;
  item: T;
  onAction: (action: ItemAction, item: T) => void;
  canRetry?: boolean;
  agents?: SendTarget[];
  onSendToAgent?: (item: T, agent: SendTarget) => void;
}) {
  const { Item, Separator } = PARTS[menu];
  return (
    <>
      {canRetry ? (
        <>
          <Item onClick={() => onAction("retry", item)}>
            <RotateCw aria-hidden="true" />
            <Trans>Try again</Trans>
          </Item>
          <Separator />
        </>
      ) : null}
      <SendToAgentMenu
        menu={menu}
        agents={onSendToAgent ? agents : undefined}
        onPick={(agent) => onSendToAgent?.(item, agent)}
      />
      <Item onClick={() => onAction("move", item)}>
        <FolderInput aria-hidden="true" />
        <Trans>Move</Trans>
      </Item>
      <Item onClick={() => onAction("rename", item)}>
        <Pencil aria-hidden="true" />
        <Trans>Rename</Trans>
      </Item>
      <Separator />
      <Item variant="destructive" onClick={() => onAction("delete", item)}>
        <Trash2 aria-hidden="true" />
        <Trans>Delete</Trans>
      </Item>
    </>
  );
}

/** The "..." button and its menu of {@link ItemMenuItems}. */
export function ItemMenu<T extends { name: string }>({
  item,
  onAction,
  canRetry = false,
  agents,
  onSendToAgent,
  open,
  onOpenChange,
  triggerTabIndex,
  className,
}: {
  item: T;
  onAction: (action: ItemAction, item: T) => void;
  canRetry?: boolean;
  /** Files only: the agents a file can be sent to. */
  agents?: SendTarget[];
  onSendToAgent?: (item: T, agent: SendTarget) => void;
  /** Controlled open state, so a right-click elsewhere can open the menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** -1 where the row itself is the Tab stop (the folder tree). */
  triggerTabIndex?: number;
  className?: string;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className={className} />}
        tabIndex={triggerTabIndex}
        aria-label={t`More actions for ${item.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      {/* React events bubble out of the portal into the row, which would pin it. */}
      <DropdownMenuContent
        align="end"
        className="min-w-40"
        onClick={(event) => event.stopPropagation()}
      >
        <ItemMenuItems
          menu="dropdown"
          item={item}
          onAction={onAction}
          canRetry={canRetry}
          agents={agents}
          onSendToAgent={onSendToAgent}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
