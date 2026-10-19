/**
 * The markRead request for what the reader has seen, or null when nothing should be sent: a thread
 * marked unread by hand stays unread until it is opened again, and a pinned search window is not
 * the end of the thread, so reading there never moves the boundary.
 */
export function threadReadInput(options: {
  target: { botId: string } | { groupId: string };
  pinned: boolean;
  manuallyUnread: boolean;
  messageId: string;
  toEnd: boolean;
}) {
  if (options.pinned || options.manuallyUnread) return null;
  return { ...options.target, upToMessageId: options.messageId, toEnd: options.toEnd };
}
