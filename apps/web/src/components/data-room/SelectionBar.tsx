import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  BotAvatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Download, Mail, Send, X } from "lucide-react";
import type { SendTarget } from "./SendToAgent";

/** What can be done with the ticked files. It shows only while at least one row is ticked. */
export function SelectionBar({
  count,
  total,
  onSelectAll,
  busy = false,
  onDownload,
  onSend,
  onClear,
  agents,
  onSendToAgent,
}: {
  count: number;
  /** How many files the room holds in this view, when more than the ticked ones are known. */
  total?: number;
  /** Ticks every file of the view, loaded or not; shown only when `total` is larger than `count`. */
  onSelectAll?: () => void;
  /** A download or a send is reading the files. */
  busy?: boolean;
  onDownload: () => void;
  /** Without it (no connected mailbox is known) there is no Email. */
  onSend?: () => void;
  onClear: () => void;
  /** The agents the files can go to; without any there is no Send to agent. */
  agents?: SendTarget[];
  onSendToAgent?: (agent: SendTarget) => void;
}) {
  if (count === 0) return null;
  const more = total !== undefined && total > count && onSelectAll;
  return (
    // Drawn over the foot of the list, so ticking a row never moves the table or hides the ticked row.
    <div
      role="toolbar"
      data-testid="data-room-selection"
      className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 border-t border-border bg-background px-3 py-1.5 text-sm shadow-sm"
    >
      <span className="me-auto font-medium">
        {more ? (
          <Trans>
            {count} of {total} selected
          </Trans>
        ) : (
          <Trans>{count} selected</Trans>
        )}
        {more ? (
          <Button variant="link" size="xs" className="ms-2 h-auto p-0" onClick={onSelectAll}>
            <Trans>Select all {total}</Trans>
          </Button>
        ) : null}
      </span>
      <Button variant="outline" size="sm" disabled={busy} onClick={onDownload}>
        <Download aria-hidden="true" />
        <Trans>Download</Trans>
      </Button>
      {onSend ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onSend}>
          <Mail aria-hidden="true" />
          <Trans>Email</Trans>
        </Button>
      ) : null}
      {agents?.length && onSendToAgent ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" disabled={busy}>
                <Send aria-hidden="true" />
                <Trans>Send to agent</Trans>
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="max-h-72 w-max min-w-40 max-w-[calc(100vw-2rem)]"
          >
            {agents.map((agent) => (
              <DropdownMenuItem key={agent.id} onClick={() => onSendToAgent(agent)}>
                <BotAvatar color={agent.color} identity={agent.id} size={16} status="idle" />
                <span className="truncate">{agent.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button variant="ghost" size="icon-sm" aria-label={t`Clear selection`} onClick={onClear}>
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
