/**
 * Sprite format. A sprite is a list of frames; a frame is an array of equal-length
 * strings, one per pixel row. Each character is a colour role:
 *   r destructive   y warning   g success   k foreground   m muted-foreground   w card   . empty
 * Every frame of a sprite must have the same width and height. `box` is the area the
 * sprite lives in (default: the grid size, 16px tall is the house height); a box wider
 * than the grid lets the sprite drive back and forth across it. To add an icon, define
 * a PixelSprite here, add it to PIXEL_ICONS, and add a story.
 */
export type PixelSprite = {
  frames: readonly (readonly string[])[];
  /** Time for one pass through all frames. */
  frameMs?: number;
  box?: { w: number; h: number };
  /** Set to make the sprite drive back and forth across its box; otherwise it stays put. */
  driveMs?: number;
};

export const PIXEL_COLORS: Record<string, string> = {
  r: "var(--destructive)",
  y: "var(--warning)",
  g: "var(--success)",
  k: "var(--foreground)",
  m: "var(--muted-foreground)",
  w: "var(--card)",
};

const truckBody = [
  "..mmmmmmmm.rrrr.",
  "rrrrrrrrrrrrwwwr",
  "rrrrrrrrrrrrwwwr",
  "ryyyyyyyyyyrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  ".kkk....kkk.kkk.",
  ".kmk....kmk.kmk.",
  ".kkk....kkk.kkk.",
];

export const fireTruck: PixelSprite = {
  frames: [
    ["...........y....", ...truckBody],
    ["..y.............", ...truckBody],
  ],
  frameMs: 500,
  box: { w: 28, h: 16 },
  driveMs: 2400,
};

export const fire: PixelSprite = {
  frames: [
    [
      "...r....",
      "...rr...",
      "..rrr.r.",
      "..rrrrr.",
      ".rrryrrr",
      ".rryyyrr",
      ".rryyyrr",
      ".rryyyrr",
      "..ryyyr.",
      "...rrr..",
    ],
    [
      ".....r..",
      "...rr.r.",
      "...rrrr.",
      "..rrrrr.",
      ".rrrryr.",
      ".rryyyrr",
      ".rryyyrr",
      ".rryyyrr",
      "..ryyyr.",
      "...rrr..",
    ],
    [
      "....r...",
      "...rr...",
      "..rrrr..",
      ".rrrrrr.",
      ".rrryrrr",
      ".rryyyrr",
      ".rrryyrr",
      ".rryyyrr",
      "..ryyyr.",
      "...rrr..",
    ],
  ],
  frameMs: 600,
  box: { w: 10, h: 16 },
};

const bubble = [
  ".kkkkkkkk.",
  "kwwwwwwwwk",
  "kwwyyyywwk",
  "kwwwwwyywk",
  "kwwwwyywwk",
  "kwwwwywwwk",
  "kwwwwwwwwk",
];
const bubbleTail = [".kkkkkkkk.", "..kk......", "..k......."];

/** Needs input: a speech bubble whose question mark loses its dot every other beat. */
export const needsInput: PixelSprite = {
  frames: [
    [...bubble, "kwwwwywwwk", ...bubbleTail],
    [...bubble, "kwwwwwwwwk", ...bubbleTail],
  ],
  frameMs: 1000,
  box: { w: 12, h: 16 },
};

const warning = [
  ".....y.....",
  "....yyy....",
  "...yykyy...",
  "...yykyy...",
  "..yyykyyy..",
  "..yyykyyy..",
  ".yyyyyyyyy.",
  ".yyyykyyyy.",
  "yyyyyyyyyyy",
];

/** Failed: a warning sign that flashes between warning and destructive. */
export const failed: PixelSprite = {
  frames: [warning, warning.map((row) => row.replaceAll("y", "r"))],
  frameMs: 800,
  box: { w: 13, h: 16 },
};

const pole = ["k.........", "k.........", "k.........", "k.........", "k.........", "k........."];

/** Done: a flag that waves. */
export const done: PixelSprite = {
  frames: [
    ["kgggggg...", "kgggggggg.", "kgggggg...", "kggg......", ...pole, "kkkk......"],
    ["kggggg....", "kgggggg...", "kggggggg..", "kgggg.....", ...pole, "kkkk......"],
  ],
  frameMs: 700,
  box: { w: 12, h: 16 },
};

/** New: a sparkle that twinkles. */
export const sparkle: PixelSprite = {
  frames: [
    ["...k...", "...k...", "..kkk..", "kkkkkkk", "..kkk..", "...k...", "...k..."],
    [".......", ".......", "...k...", "..kkk..", "...k...", ".......", "......."],
  ],
  frameMs: 900,
  box: { w: 9, h: 16 },
};

export const PIXEL_ICONS = { fire, fireTruck, needsInput, failed, done, sparkle } as const;
