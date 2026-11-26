import { expect, it } from "vitest";
import { callAudioMissing, createChunkCutter, MAX_CHUNK_MS, MIN_CHUNK_MS } from "./chunker";

const STEP = 50;
/** Runs level samples through a cutter and returns the elapsed ms of each cut. */
function cuts(level: (ms: number) => number, totalMs: number): number[] {
  const cutter = createChunkCutter();
  const out: number[] = [];
  for (let ms = STEP; ms <= totalMs; ms += STEP) if (cutter.tick(level(ms), STEP)) out.push(ms);
  return out;
}

it("cuts at the first quiet point after the minimum, not at the first dip", () => {
  // Loud speech with a short dip at 5 s (too early) and a real pause at 30 s.
  const level = (ms: number) =>
    (ms > 5000 && ms < 5400) || (ms > 30_000 && ms < 31_000) ? 0 : 0.2;
  const [first] = cuts(level, 59_000);
  expect(first).toBeGreaterThanOrEqual(30_000);
  expect(first).toBeLessThan(31_000);
});

it("does not cut a pause shorter than the quiet window", () => {
  const level = (ms: number) => (ms > 30_000 && ms < 30_300 ? 0 : 0.2);
  expect(cuts(level, 59_000)).toEqual([]);
});

it("cuts at the 60 s cap when the speaker never pauses", () => {
  expect(cuts(() => 0.2, 130_000)).toEqual([MAX_CHUNK_MS, 2 * MAX_CHUNK_MS]);
});

it("cuts right after the minimum on a silent track", () => {
  const [first] = cuts(() => 0, 60_000);
  expect(first).toBeGreaterThanOrEqual(MIN_CHUNK_MS);
  expect(first).toBeLessThan(MIN_CHUNK_MS + 1000);
});

it("reports a silent shared tab only after 10 seconds", () => {
  expect(callAudioMissing(0, 9_999)).toBe(false);
  expect(callAudioMissing(0, 10_000)).toBe(true);
  expect(callAudioMissing(0.3, 20_000)).toBe(false);
});
