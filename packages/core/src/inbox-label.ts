// Placeholder so the tests fail on behavior; the implementation follows.
export type InboxLabel = "attention" | "newsletter" | "spam" | "junk";
export type InboxLabelRow = {
  needsReply: boolean | null;
  priority: string | null;
  category: string | null;
  feedback: string | null;
};
export function inboxLabel(_row: InboxLabelRow): InboxLabel | null {
  return null;
}
