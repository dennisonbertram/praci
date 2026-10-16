import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export type ItemAction = "move" | "rename" | "delete";

/** Move, Rename and Delete for one item. */
export function ItemMenu({
  item,
  onAction,
  className,
}: {
  item: DataRoomApiItem;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className={className} />}
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
