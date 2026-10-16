import { createContext, useContext } from "react";

/** Lets a card in the chat turn off one built-in tool of the bot whose message it is in. */
export interface BotToolControls {
  /** The bot's name when the person owns it and can change its tools; otherwise undefined. */
  editableBotName(botId: string | undefined): string | undefined;
  disableTool(botId: string, tool: string): Promise<void>;
  /** Opens the mail composer on a message the person still needs to send themselves. */
  openComposer(draft: ComposerDraft): void;
}

export interface ComposerDraft {
  connectionId: string;
  account: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}

export const BotToolControlsContext = createContext<BotToolControls | null>(null);

export const useBotToolControls = () => useContext(BotToolControlsContext);
