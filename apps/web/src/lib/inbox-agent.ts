export function findInboxAgent<T extends { spawnKey: string | null }>(
  _bots: readonly T[],
  _userId: string | null | undefined,
): T | undefined {
  return undefined;
}
