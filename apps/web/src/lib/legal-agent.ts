import { findPageAgent } from "@rakazo/contracts";

/** The signed-in user's own Legal agent; another member's agent in the same space does not match. */
export const findLegalAgent = <T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined => findPageAgent(bots, "legal", userId);
