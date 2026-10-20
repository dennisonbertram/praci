// The one small label an Inbox row shows, derived from triage. These are Praci labels only;
// nothing is written to the mailbox. Pure, so web and mobile show the same label for a row.
export type InboxLabel = "attention" | "newsletter" | "spam" | "junk";

export type InboxLabelRow = {
  needsReply: boolean | null;
  priority: string | null;
  category: string | null;
  feedback: string | null;
};

/**
 * Spam and Junk win over Needs attention, which wins over Newsletter. A row triage has not seen
 * (or triage is off) has no category and gets no label. Suspicious mail keeps only its warning icon.
 * A sender marked noise never reads as Needs attention.
 */
export function inboxLabel(row: InboxLabelRow): InboxLabel | null {
  const { category } = row;
  if (category === null) return null;
  if (category === "spam") return "spam";
  if (category === "bulk" || category === "scam") return "junk";
  if (category === "suspicious") return null;
  if (
    row.feedback !== "noise" &&
    (row.needsReply === true ||
      row.priority === "critical" ||
      row.priority === "important" ||
      category === "action")
  ) {
    return "attention";
  }
  return category === "newsletter" ? "newsletter" : null;
}
