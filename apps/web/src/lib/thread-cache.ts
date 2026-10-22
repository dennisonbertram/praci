import type { ThreadSnapshot } from "@rakazo/contracts";

/** Remembers a bot's last thread (least recently seen dropped past `limit`) so revisiting it paints at once. */
export function rememberThread(
  cache: Map<string, ThreadSnapshot>,
  snapshot: ThreadSnapshot | null,
  limit: number,
) {
  if (!snapshot?.botId || snapshot.groupId) return;
  cache.delete(snapshot.botId);
  cache.set(snapshot.botId, snapshot);
  if (cache.size > limit) cache.delete(cache.keys().next().value as string);
}
