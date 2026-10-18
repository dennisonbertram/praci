import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { FolderInput, MoreHorizontal, Pencil, RotateCw, Trash2 } from "lucide-react";

export type ItemAction = "move" | "rename" | "delete" | "retry";

/** Move, Rename and Delete for one item or folder, led by Try again for a file that failed. */
export function ItemMenu<T extends { name: string }>({
  item,
  onAction,
  canRetry = false,
  open,
  onOpenChange,
  triggerTabIndex,
  className,
}: {
  item: T;
  onAction: (action: ItemAction, item: T) => void;
  canRetry?: boolean;
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
        className="min-w-36"
        onClick={(event) => event.stopPropagation()}
      >
        {canRetry ? (
          <>
            <DropdownMenuItem onClick={() => onAction("retry", item)}>
              <RotateCw aria-hidden="true" />
              <Trans>Try again</Trans>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => onAction("move", item)}>
          <FolderInput aria-hidden="true" />
          <Trans>Move</Trans>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("rename", item)}>
          <Pencil aria-hidden="true" />
          <Trans>Rename</Trans>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onAction("delete", item)}>
          <Trash2 aria-hidden="true" />
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
