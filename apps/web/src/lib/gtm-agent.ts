import { findPageAgent } from "@rakazo/contracts";

export const findGtmAgent = <T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined => findPageAgent(bots, "gtm", userId);
