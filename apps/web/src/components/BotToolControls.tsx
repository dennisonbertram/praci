import { createContext, useContext } from "react";

/** Lets a card in the chat turn off one built-in tool of the bot whose message it is in. */
export interface BotToolControls {
  /** The bot's name when the person owns it and can change its tools; otherwise undefined. */
  editableBotName(botId: string | undefined): string | undefined;
  disableTool(botId: string, tool: string): Promise<void>;
}

export const BotToolControlsContext = createContext<BotToolControls | null>(null);

export const useBotToolControls = () => useContext(BotToolControlsContext);
