import { createContext, useContext } from "react";

/** Lets a card in the chat turn off one built-in tool of the bot whose message it is in. */
export interface BotToolControls {
  /** The bot's name when the person owns it and can change its tools; otherwise undefined. */
  editableBotName(botId: string | undefined): string | undefined;
  disableTool(botId: string, tool: string): Promise<void>;
  /** Whether the bot may send mail, so a draft can offer Send now. */
  canSend(botId: string | undefined): boolean;
  /** Sends the draft a saved mail_draft card holds; the server finds the draft. */
  sendDraft(message: { id: string; runId?: string | null }): Promise<void>;
  /** Opens the mail composer on a message the person still needs to send themselves. */
  openComposer(draft: ComposerDraft): void;
  /** Opens the usual confirmation to clear the open conversation. */
  clearConversation?(): void;
  /** Opens Settings > Privacy and approvals, where a standing approval can be removed. */
  openApprovalSettings?(): void;
}

export interface ComposerDraft {
  connectionId: string;
  account: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  /** The synced message answered, so the reply stays in its thread. */
  replyToId?: string;
}

export const BotToolControlsContext = createContext<BotToolControls | null>(null);

export const useBotToolControls = () => useContext(BotToolControlsContext);
