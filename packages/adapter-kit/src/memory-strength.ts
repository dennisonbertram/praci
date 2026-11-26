export type MemoryKind = "preference" | "fact" | "task";

export const MEMORY_KINDS: readonly MemoryKind[] = ["preference", "fact", "task"];

/**
 * Days for an unused memory to lose half its strength. A preference ("always reply in French")
 * stays true for a long time, a fact (a client's address) changes occasionally, and a task or
 * one-off detail ("send the deck Friday") is stale within weeks.
 */
export const MEMORY_HALF_LIFE_DAYS: Record<MemoryKind, number> = {
  preference: 365,
  fact: 90,
  task: 14,
};

/** Recall leaves out memories weaker than this. About 3.3 half-lives: a task after 47 days, a fact after 10 months. */
export const MEMORY_MIN_STRENGTH = 0.1;

export interface MemoryFadeInput {
  kind?: string | null;
  updatedAt?: string | Date | null;
  lastUsedAt?: string | Date | null;
  useCount?: number | null;
  pinned?: boolean | null;
}

const DAY_MS = 86_400_000;

function time(value: string | Date | null | undefined): number | undefined {
  const ms = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * 1 for new or pinned memories, falling toward 0 by half every kind half-life since the last
 * write. Use slows the fade: each use stretches the half-life by 1 + ln(1 + uses), but only
 * while the last use is newer than one half-life, so a memory nobody has used lately fades
 * at the plain rate. Computed on read; nothing is stored.
 */
export function memoryStrength(memory: MemoryFadeInput, now: Date): number {
  if (memory.pinned) return 1;
  const written = time(memory.updatedAt);
  if (written === undefined) return 1;
  const halfLife = MEMORY_HALF_LIFE_DAYS[memory.kind as MemoryKind] ?? MEMORY_HALF_LIFE_DAYS.fact;
  const lastUsed = time(memory.lastUsedAt);
  const reinforced =
    lastUsed !== undefined && now.getTime() - lastUsed < halfLife * DAY_MS
      ? 1 + Math.log(1 + Math.max(0, memory.useCount ?? 0))
      : 1;
  const ageDays = Math.max(0, now.getTime() - written) / DAY_MS;
  return 0.5 ** (ageDays / (halfLife * reinforced));
}
