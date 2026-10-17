/**
 * A half-written message per chat, kept for this browser tab so switching chats and coming back
 * keeps it. Storage can be missing or blocked; then drafts simply do not survive a switch.
 */
const PREFIX = "rakazo.chatDraft:";

export function readChatDraft(chatKey: string | undefined): string {
  if (!chatKey) return "";
  try {
    return sessionStorage.getItem(PREFIX + chatKey) ?? "";
  } catch {
    return "";
  }
}

export function writeChatDraft(chatKey: string | undefined, text: string): void {
  if (!chatKey) return;
  try {
    if (text) sessionStorage.setItem(PREFIX + chatKey, text);
    else sessionStorage.removeItem(PREFIX + chatKey);
  } catch {
    // Quota or private mode: the draft lives only while the composer stays open.
  }
}
