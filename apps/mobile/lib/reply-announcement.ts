type AnnounceableMessage = { id: string; role: string };

/** Finds the newest assistant reply that has not been announced in this thread. */
export function replyToAnnounce<T extends AnnounceableMessage>(
  messages: readonly T[],
  announcedIds: ReadonlySet<string>,
): T | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (
      message.role === "assistant" &&
      !message.id.startsWith("progress:") &&
      !announcedIds.has(message.id)
    ) {
      return message;
    }
  }
  return null;
}
