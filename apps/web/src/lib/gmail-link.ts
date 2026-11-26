import type { MailApproval } from "@rakazo/contracts";

/**
 * Where a finished mail card's message lives in Gmail (the address in /u/ picks the Google account):
 * the sent conversation when the server recorded its id, else the Sent folder or Drafts. A card that
 * has not finished, or names no account, has no place yet. ponytail: a saved draft opens Drafts,
 * because Gmail's compose= parameter takes an id the API does not return.
 */
export function gmailFolderUrl(
  mail: Pick<MailApproval, "account" | "outcome" | "threadId" | "messageId">,
): string | null {
  if (!mail.account || (mail.outcome !== "sent" && mail.outcome !== "saved")) return null;
  const base = `https://mail.google.com/mail/u/${encodeURIComponent(mail.account)}/`;
  if (mail.outcome === "saved") return `${base}#drafts`;
  const id = mail.threadId || mail.messageId;
  return id ? `${base}#all/${encodeURIComponent(id)}` : `${base}#sent`;
}

/**
 * Where an audit request's agent draft lives in Gmail: the mail thread it was drafted in (the draft
 * and any New mail are both there), or Drafts for a request the agent added with no mail. The /u/
 * part picks the Google account; without one Gmail uses the signed-in default. There is no web URL
 * for the draft itself: Gmail's compose= parameter takes an id the API does not return.
 */
export function gmailThreadUrl(account: string | undefined, threadId: string | null): string {
  const base = `https://mail.google.com/mail/u/${encodeURIComponent(account ?? "0")}/`;
  return threadId ? `${base}#all/${encodeURIComponent(threadId)}` : `${base}#drafts`;
}
