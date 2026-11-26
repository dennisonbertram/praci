import { findPageAgent } from "@rakazo/contracts";

export const findCompanyAgent = <T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
  importer = false,
): T | undefined => findPageAgent(bots, importer ? "company-importer" : "company", userId);
