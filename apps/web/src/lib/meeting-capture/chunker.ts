/** The shortest and longest stretch of audio in one uploaded chunk. */
export const MIN_CHUNK_MS = 20_000;
export const MAX_CHUNK_MS = 60_000;
/** How long the track must stay quiet before a cut between words is allowed. */
export const QUIET_CUT_MS = 600;
/** RMS level (0 to 1) under which a track counts as quiet. */
export const QUIET_LEVEL = 0.02;
/** A shared tab that stays under this for NO_CALL_AUDIO_MS has no call audio. */
export const NO_CALL_AUDIO_LEVEL = 0.005;
export const NO_CALL_AUDIO_MS = 10_000;

export type ChunkLimits = { minMs: number; maxMs: number; quietMs: number; quietLevel: number };
export const DEFAULT_LIMITS: ChunkLimits = {
  minMs: MIN_CHUNK_MS,
  maxMs: MAX_CHUNK_MS,
  quietMs: QUIET_CUT_MS,
  quietLevel: QUIET_LEVEL,
};

export type ChunkClock = { elapsedMs: number; quietMs: number };

/** Moves the clock forward by one level sample. */
export function advance(
  clock: ChunkClock,
  level: number,
  dtMs: number,
  quietLevel = QUIET_LEVEL,
): ChunkClock {
  return {
    elapsedMs: clock.elapsedMs + dtMs,
    quietMs: level < quietLevel ? clock.quietMs + dtMs : 0,
  };
}

/** Cut at the first quiet point once the chunk is long enough, and never later than the cap. */
export function shouldCut(clock: ChunkClock, limits: ChunkLimits = DEFAULT_LIMITS): boolean {
  if (clock.elapsedMs >= limits.maxMs) return true;
  return clock.elapsedMs >= limits.minMs && clock.quietMs >= limits.quietMs;
}

/** Feed it level samples; it returns true when the current chunk should end here. */
export function createChunkCutter(limits: ChunkLimits = DEFAULT_LIMITS) {
  let clock: ChunkClock = { elapsedMs: 0, quietMs: 0 };
  return {
    tick(level: number, dtMs: number): boolean {
      clock = advance(clock, level, dtMs, limits.quietLevel);
      if (!shouldCut(clock, limits)) return false;
      clock = { elapsedMs: 0, quietMs: 0 };
      return true;
    },
  };
}

/** True when a shared tab has made no sound for its first NO_CALL_AUDIO_MS. */
export function callAudioMissing(peakLevel: number, elapsedMs: number): boolean {
  return elapsedMs >= NO_CALL_AUDIO_MS && peakLevel < NO_CALL_AUDIO_LEVEL;
}
