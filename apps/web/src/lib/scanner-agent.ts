import { t } from "@lingui/core/macro";
import { findPageAgent } from "@rakazo/contracts";

export const findScannerAgent = <T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId?: string | null,
): T | undefined => findPageAgent(bots, "scanner", userId);

export const scannerAgentSuggestions = () => [
  t`What did I scan recently?`,
  t`Name and type my latest scan`,
];
