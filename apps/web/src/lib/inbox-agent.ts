import { findPageAgent } from "@rakazo/contracts";

/** The signed-in user's own Inbox agent; another member's agent in the same space does not match. */
export const findInboxAgent = <T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined => findPageAgent(bots, "inbox", userId);
