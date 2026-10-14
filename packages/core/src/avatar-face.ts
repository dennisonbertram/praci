/**
 * Procedural eye animation for bot avatars. Pure and deterministic: the same
 * (seed, mood, timeMs) always yields the same pose, so web (rAF) and mobile
 * (Reanimated) render identical behavior. Every exported or internal function is
 * a worklet, and nothing reads the clock; callers pass time in.
 *
 * Tweak behavior by editing numbers in MOOD_TUNING. Add a mood by adding it to
 * AVATAR_MOODS and giving it a row.
 */

export const AVATAR_MOODS = [
  "idle",
  "listening",
  "thinking",
  "working",
  "happy",
  "sad",
  "surprised",
  "sleepy",
  "confused",
  "error",
] as const;
export type AvatarMood = (typeof AVATAR_MOODS)[number];

export interface AvatarEyePose {
  /** Gaze offset, -1..1. The renderer multiplies by its own travel range. */
  x: number;
  y: number;
  /** 0 closed .. 1 fully open (vertical scale). */
  open: number;
  /** 0 pill .. 1 upside-down-U "^" arc. */
  smile: number;
  /** Degrees. Positive tilts the inner corner down (angry); negative is worried. The renderer mirrors it for the right eye. */
  tilt: number;
  /** Overall eye size multiplier. */
  scale: number;
}

export interface AvatarFacePose {
  left: AvatarEyePose;
  right: AvatarEyePose;
  /** Vertical body offset in avatar units, -1..1. */
  bob: number;
  /** Body scaleY delta (-0.06..0.06); scaleX = 1 - squash * 0.6. */
  squash: number;
}

interface MoodTuning {
  /** Time an eye holds one fixation, ms. */
  fixMin: number;
  fixMax: number;
  /** Random gaze spread around the bias, -1..1 units. */
  gx: number;
  gy: number;
  /** Gaze bias. bx flips sign between fixations when `flip` is set. */
  bx: number;
  by: number;
  flip: boolean;
  /** Alternate left and right every fixation (reading). */
  scan: boolean;
  /** Time between blinks, ms. */
  blinkMin: number;
  blinkMax: number;
  /** Blink duration multiplier. */
  blinkSlow: number;
  /** No blinks before this time, ms. */
  noBlinkMs: number;
  /** Eye openness (left, right). */
  openL: number;
  openR: number;
  smile: number;
  tilt: number;
  /** Slow tilt wobble amplitude, degrees. */
  wobble: number;
  scale: number;
  /** Body bounce amplitude and speed (cycles per second). */
  bob: number;
  bobHz: number;
  /** Breathing squash amplitude. */
  squash: number;
  /** Quick horizontal shake amplitude. */
  shake: number;
}

const BASE: MoodTuning = {
  fixMin: 700,
  fixMax: 2400,
  gx: 0.9,
  gy: 0.5,
  bx: 0,
  by: 0,
  flip: false,
  scan: false,
  blinkMin: 2500,
  blinkMax: 5500,
  blinkSlow: 1,
  noBlinkMs: 200,
  openL: 1,
  openR: 1,
  smile: 0,
  tilt: 0,
  wobble: 0,
  scale: 1,
  bob: 0,
  bobHz: 0.3,
  squash: 0.018,
  shake: 0,
};

export const MOOD_TUNING: Record<AvatarMood, MoodTuning> = {
  idle: { ...BASE },
  listening: { ...BASE, fixMin: 1800, fixMax: 3600, gx: 0.12, gy: 0.1, scale: 1.05 },
  thinking: {
    ...BASE,
    fixMin: 2200,
    fixMax: 4200,
    gx: 0.2,
    gy: 0.15,
    bx: 0.6,
    by: -0.7,
    flip: true,
    openL: 0.9,
    openR: 0.9,
  },
  working: {
    ...BASE,
    fixMin: 260,
    fixMax: 520,
    gx: 0.15,
    gy: 0.05,
    bx: 0.8,
    by: 0.2,
    scan: true,
    blinkMin: 3000,
    blinkMax: 6000,
  },
  happy: {
    ...BASE,
    fixMin: 1200,
    fixMax: 2600,
    gx: 0.3,
    gy: 0.15,
    smile: 1,
    bob: 0.5,
    bobHz: 2,
    blinkMin: 4000,
    blinkMax: 7000,
  },
  sad: {
    ...BASE,
    fixMin: 1800,
    fixMax: 3600,
    gx: 0.25,
    gy: 0.1,
    by: 0.6,
    tilt: -12,
    openL: 0.8,
    openR: 0.8,
    blinkSlow: 1.6,
  },
  surprised: {
    ...BASE,
    fixMin: 1500,
    fixMax: 3000,
    gx: 0.15,
    gy: 0.1,
    scale: 1.25,
    noBlinkMs: 600,
  },
  sleepy: {
    ...BASE,
    fixMin: 2500,
    fixMax: 5000,
    gx: 0.3,
    gy: 0.1,
    by: 0.5,
    openL: 0.25,
    openR: 0.25,
    blinkMin: 1800,
    blinkMax: 3600,
    blinkSlow: 2.5,
    squash: 0.03,
  },
  confused: {
    ...BASE,
    fixMin: 700,
    fixMax: 1600,
    gx: 0.7,
    gy: 0.4,
    openL: 0.65,
    wobble: 8,
  },
  error: {
    ...BASE,
    fixMin: 2000,
    fixMax: 3500,
    gx: 0.2,
    gy: 0.1,
    openL: 0.7,
    openR: 0.7,
    tilt: 14,
    shake: 0.5,
  },
};

/** Gaze saccade length range and eye blink timing, ms. */
const SACCADE_MIN_MS = 90;
const SACCADE_MAX_MS = 140;
const BLINK_CLOSE_MS = 60;
const BLINK_OPEN_MS = 90;
const BLINK_CLOSED_OPEN = 0.08;
const DOUBLE_BLINK_CHANCE = 0.15;
const DOUBLE_BLINK_GAP_MS = 240;

/** Deterministic float in [0, 1) from three integers. */
function rand(seed: number, slot: number, salt: number): number {
  "worklet";
  let h =
    Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(slot | 0, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  "worklet";
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  "worklet";
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

/** Start time of jittered-grid slot k. Slots have mean length `mean` and never overlap. */
function slotStart(seed: number, k: number, mean: number, spread: number, salt: number): number {
  "worklet";
  return k * mean + (rand(seed, k, salt) - 0.5) * spread;
}

function slotIndex(seed: number, t: number, mean: number, spread: number, salt: number): number {
  "worklet";
  let k = Math.floor(t / mean);
  if (slotStart(seed, k + 1, mean, spread, salt) <= t) k += 1;
  else if (slotStart(seed, k, mean, spread, salt) > t) k -= 1;
  return k;
}

function gazeTarget(seed: number, k: number, tune: MoodTuning): { x: number; y: number } {
  "worklet";
  let x = (rand(seed, k, 11) - 0.5) * 2 * tune.gx;
  if (tune.scan) {
    x += (k % 2 === 0 ? -1 : 1) * tune.bx * (0.7 + 0.3 * rand(seed, k, 15));
  } else {
    x += tune.flip && rand(seed, k, 13) < 0.5 ? -tune.bx : tune.bx;
  }
  const y = tune.by + (rand(seed, k, 12) - 0.5) * 2 * tune.gy;
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}

function gazeAt(seed: number, tune: MoodTuning, timeMs: number): { x: number; y: number } {
  "worklet";
  const t = timeMs + rand(seed, 0, 1) * 100000;
  const spread = (tune.fixMax - tune.fixMin) * 0.8;
  const mean = (tune.fixMin + tune.fixMax) / 2;
  const k = slotIndex(seed, t, mean, spread, 21);
  const from = gazeTarget(seed, k - 1, tune);
  const to = gazeTarget(seed, k, tune);
  const duration = lerp(SACCADE_MIN_MS, SACCADE_MAX_MS, rand(seed, k, 22));
  const e = easeOutCubic((t - slotStart(seed, k, mean, spread, 21)) / duration);
  const drift = timeMs / 1000;
  return {
    x: lerp(from.x, to.x, e) + Math.sin(drift * 1.3 + seed) * 0.03,
    y: lerp(from.y, to.y, e) + Math.sin(drift * 0.9 + seed * 2) * 0.02,
  };
}

/** Blink closure 0 (open) .. 1 (closed) for one blink starting at `start`. */
function blinkShape(t: number, start: number, slow: number): number {
  "worklet";
  const close = BLINK_CLOSE_MS * slow;
  const open = BLINK_OPEN_MS * slow;
  const local = t - start;
  if (local < 0 || local >= close + open) return 0;
  if (local < close) return easeOutCubic(local / close);
  return 1 - easeOutCubic((local - close) / open);
}

function blinkAt(seed: number, tune: MoodTuning, timeMs: number): number {
  "worklet";
  if (timeMs < tune.noBlinkMs) return 0;
  const spread = tune.blinkMax - tune.blinkMin;
  const mean = (tune.blinkMin + tune.blinkMax) / 2;
  const t = timeMs + rand(seed, 0, 2) * 100000;
  const k = Math.floor(t / mean);
  let closed = 0;
  for (let i = k - 1; i <= k + 1; i += 1) {
    const start = slotStart(seed, i, mean, spread, 31);
    closed = Math.max(closed, blinkShape(t, start, tune.blinkSlow));
    if (rand(seed, i, 32) < DOUBLE_BLINK_CHANCE) {
      closed = Math.max(
        closed,
        blinkShape(t, start + DOUBLE_BLINK_GAP_MS * tune.blinkSlow, tune.blinkSlow),
      );
    }
  }
  return closed;
}

/** Map a run status to the mood the avatar shows by default. */
export function moodForRunStatus(status: string | null | undefined): AvatarMood {
  "worklet";
  switch (status) {
    case "queued":
    case "leased":
      return "thinking";
    case "running":
      return "working";
    case "waiting_input":
    case "waiting_takeover":
      return "listening";
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

/** Face pose at `timeMs`. `lookAt` (-1..1) replaces the gaze target. */
export function avatarFacePose(
  seed: number,
  mood: AvatarMood,
  timeMs: number,
  lookAt?: { x: number; y: number },
): AvatarFacePose {
  "worklet";
  const tune = MOOD_TUNING[mood] ?? MOOD_TUNING.idle;
  const gaze = lookAt
    ? { x: clamp(lookAt.x, -1, 1), y: clamp(lookAt.y, -1, 1) }
    : gazeAt(seed, tune, timeMs);
  let x = gaze.x;
  if (tune.shake > 0) {
    const phase = timeMs % 3500;
    if (phase < 450) x += Math.sin(phase * 0.06) * tune.shake * (1 - phase / 450);
  }
  const blinkOpen = 1 - (1 - BLINK_CLOSED_OPEN) * blinkAt(seed, tune, timeMs);
  const wobble = Math.sin(timeMs / 1100 + seed) * tune.wobble;
  const eye = (open: number, tiltSign: number): AvatarEyePose => ({
    x: clamp(x, -1, 1),
    y: gaze.y,
    open: clamp(open * blinkOpen, 0, 1),
    smile: tune.smile,
    tilt: tune.tilt + wobble * tiltSign,
    scale: tune.scale,
  });
  const cycle = Math.sin((timeMs / 1000) * Math.PI * 2 * tune.bobHz + seed);
  return {
    left: eye(tune.openL, 1),
    right: eye(tune.openR, -1),
    bob: tune.bob > 0 ? -Math.abs(cycle) * tune.bob : 0,
    squash: cycle * tune.squash,
  };
}

function blendEye(a: AvatarEyePose, b: AvatarEyePose, t: number): AvatarEyePose {
  "worklet";
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    open: lerp(a.open, b.open, t),
    smile: lerp(a.smile, b.smile, t),
    tilt: lerp(a.tilt, b.tilt, t),
    scale: lerp(a.scale, b.scale, t),
  };
}

/** Linear blend between two poses, t in 0..1. Used to ease mood changes. */
export function blendAvatarFacePose(
  a: AvatarFacePose,
  b: AvatarFacePose,
  t: number,
): AvatarFacePose {
  "worklet";
  const u = clamp(t, 0, 1);
  return {
    left: blendEye(a.left, b.left, u),
    right: blendEye(a.right, b.right, u),
    bob: lerp(a.bob, b.bob, u),
    squash: lerp(a.squash, b.squash, u),
  };
}

const KAPPA = 0.5523;
/** Smallest visible eye height as a fraction of full height. */
const MIN_OPEN = 0.06;
/** Happy "^" eye, relative to the pill: width (of the short side), height, and stroke thickness (of the short side). */
const ARC_WIDTH = 1.5;
const ARC_HEIGHT = 0.62;
const ARC_THICKNESS = 0.55;

type Segment = [number, number, number, number, number, number];
type Outline = { start: [number, number]; segments: Segment[] };

function line(from: [number, number], to: [number, number]): Segment {
  "worklet";
  return [
    lerp(from[0], to[0], 1 / 3),
    lerp(from[1], to[1], 1 / 3),
    lerp(from[0], to[0], 2 / 3),
    lerp(from[1], to[1], 2 / 3),
    to[0],
    to[1],
  ];
}

/** Capsule outline: 4 straight sides and 4 quarter arcs, all cubic. */
function pillOutline(w: number, h: number): Outline {
  "worklet";
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(hw, hh);
  const k = r * KAPPA;
  const a: [number, number] = [hw - r, -hh];
  const b: [number, number] = [hw, -hh + r];
  const c: [number, number] = [hw, hh - r];
  const d: [number, number] = [hw - r, hh];
  const e: [number, number] = [-(hw - r), hh];
  const f: [number, number] = [-hw, hh - r];
  const g: [number, number] = [-hw, -hh + r];
  const i: [number, number] = [-(hw - r), -hh];
  return {
    start: a,
    segments: [
      [a[0] + k, a[1], b[0], b[1] - k, b[0], b[1]],
      line(b, c),
      [c[0], c[1] + k, d[0] + k, d[1], d[0], d[1]],
      line(d, e),
      [e[0] - k, e[1], f[0], f[1] + k, f[0], f[1]],
      line(f, g),
      [g[0], g[1] - k, i[0] - k, i[1], i[0], i[1]],
      line(i, a),
    ],
  };
}

/**
 * Upside-down-U outline with the same 8-cubic structure as the pill: right outer
 * side, right foot cap (2 quarter arcs), inner arch, left foot cap, left outer
 * side, outer arch.
 */
function arcOutline(w: number, h: number): Outline {
  "worklet";
  const m = Math.min(w, h);
  const t = m * ARC_THICKNESS;
  const half = Math.max(w, m * ARC_WIDTH) / 2;
  const height = Math.min(h, Math.max(h * ARC_HEIGHT, t * 1.9));
  const foot = t / 2;
  const k = foot * KAPPA;
  const top = -height / 2;
  const bottom = height / 2;
  const footY = bottom - foot;
  const a: [number, number] = [half, Math.min(footY - foot * 0.4, top + half * 0.8)];
  const b: [number, number] = [half, footY];
  const c: [number, number] = [half - foot, bottom];
  const d: [number, number] = [half - t, footY];
  const e: [number, number] = [-d[0], d[1]];
  const f: [number, number] = [-c[0], c[1]];
  const g: [number, number] = [-b[0], b[1]];
  const i: [number, number] = [-a[0], a[1]];
  const outerY = (top - 0.25 * a[1]) / 0.75;
  const innerY = (top + t - 0.25 * d[1]) / 0.75;
  return {
    start: a,
    segments: [
      line(a, b),
      [b[0], b[1] + k, c[0] + k, c[1], c[0], c[1]],
      [c[0] - k, c[1], d[0], d[1] + k, d[0], d[1]],
      [d[0] - half * 0.12, innerY, e[0] + half * 0.12, innerY, e[0], e[1]],
      [e[0], e[1] + k, f[0] + k, f[1], f[0], f[1]],
      [f[0] - k, f[1], g[0], g[1] + k, g[0], g[1]],
      line(g, i),
      [i[0] + half * 0.25, outerY, a[0] - half * 0.25, outerY, a[0], a[1]],
    ],
  };
}

function round2(value: number): number {
  "worklet";
  return Math.round(value * 100) / 100;
}

/**
 * SVG path for one eye centered on 0,0. Applies `open`, `smile` and `scale`;
 * the renderer applies x/y translation and tilt. Always M + 8C + Z so smile
 * blends point-wise without popping.
 */
export function avatarEyePath(width: number, height: number, pose: AvatarEyePose): string {
  "worklet";
  const w = width * pose.scale;
  const h = height * pose.scale;
  const pill = pillOutline(w, h);
  const arc = arcOutline(w, h);
  const s = clamp(pose.smile, 0, 1);
  const yScale = Math.max(MIN_OPEN, clamp(pose.open, 0, 1));
  const pt = (x: number, y: number) => `${round2(x)} ${round2(y * yScale)}`;
  let d = `M${pt(lerp(pill.start[0], arc.start[0], s), lerp(pill.start[1], arc.start[1], s))}`;
  for (let i = 0; i < pill.segments.length; i += 1) {
    const p = pill.segments[i] as Segment;
    const q = arc.segments[i] as Segment;
    d += `C${pt(lerp(p[0], q[0], s), lerp(p[1], q[1], s))} ${pt(lerp(p[2], q[2], s), lerp(p[3], q[3], s))} ${pt(lerp(p[4], q[4], s), lerp(p[5], q[5], s))}`;
  }
  return `${d}Z`;
}
