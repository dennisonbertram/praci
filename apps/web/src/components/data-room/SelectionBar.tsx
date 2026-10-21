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
  busy = false,
  onDownload,
  onSend,
  onClear,
  agents,
  onSendToAgent,
}: {
  count: number;
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
  return (
    <div
      role="toolbar"
      data-testid="data-room-selection"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-1.5 text-sm"
    >
      <span className="me-auto font-medium">
        <Trans>{count} selected</Trans>
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
          <DropdownMenuContent align="end" className="max-h-72 min-w-40">
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
