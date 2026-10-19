/**
 * Sprite format. A sprite is a list of frames; a frame is an array of equal-length
 * strings, one per pixel row. Each character is a colour role:
 *   r destructive   y warning   k foreground   m muted-foreground   w card   . empty
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
  /** Time to drive across the box once (box wider than the grid). */
  driveMs?: number;
};

export const PIXEL_COLORS: Record<string, string> = {
  r: "var(--destructive)",
  y: "var(--warning)",
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

export const PIXEL_ICONS = { fire, fireTruck } as const;
