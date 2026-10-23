import { companyAgentSpawnKey, companyImporterSpawnKey } from "@rakazo/contracts";

export function findCompanyAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
  importer = false,
): T | undefined {
  if (!userId) return undefined;
  const key = importer ? companyImporterSpawnKey(userId) : companyAgentSpawnKey(userId);
  return bots.find((bot) => bot.spawnKey === key);
}
