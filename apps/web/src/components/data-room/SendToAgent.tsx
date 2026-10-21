import { Trans } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import {
  BotAvatar,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@rakazo/ui-web";
import { Send } from "lucide-react";
import type { ElementType } from "react";

/** An agent a file can be sent to: the fields the list shows. */
export type SendTarget = Pick<Bot, "id" | "name" | "color">;

/** The same submenu in a "⋯" dropdown and in a right-click menu. */
const PARTS = {
  dropdown: {
    Sub: DropdownMenuSub,
    Trigger: DropdownMenuSubTrigger,
    Content: DropdownMenuSubContent,
    Item: DropdownMenuItem,
  },
  context: {
    Sub: ContextMenuSub,
    Trigger: ContextMenuSubTrigger,
    Content: ContextMenuSubContent,
    Item: ContextMenuItem,
  },
} satisfies Record<string, Record<string, ElementType>>;

/** "Send to agent" and the user's agents (most recent first), or nothing when there are none. */
export function SendToAgentMenu({
  menu,
  agents,
  onPick,
}: {
  menu: keyof typeof PARTS;
  agents: SendTarget[] | undefined;
  onPick: (agent: SendTarget) => void;
}) {
  if (!agents?.length) return null;
  const { Sub, Trigger, Content, Item } = PARTS[menu];
  return (
    <Sub>
      <Trigger className="whitespace-nowrap">
        <Send aria-hidden="true" />
        <Trans>Send to agent</Trans>
      </Trigger>
      <Content className="max-h-72 w-max min-w-40 max-w-[calc(100vw-2rem)]">
        {agents.map((agent) => (
          <Item key={agent.id} onClick={() => onPick(agent)}>
            <BotAvatar color={agent.color} identity={agent.id} size={16} status="idle" />
            <span className="truncate">{agent.name}</span>
          </Item>
        ))}
      </Content>
    </Sub>
  );
}
