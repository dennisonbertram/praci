import type { AvatarEyePose, AvatarFacePose, AvatarMood } from "@rakazo/core";
import { avatarEyePath } from "@rakazo/core";

/**
 * Geometry for the shared eye engine (`avatarFacePose` in `@rakazo/core`) on
 * native. Mirrors `AvatarFaceGeometry` in `@rakazo/ui-web`; every function is a
 * worklet so the Reanimated frame callback can call it on the UI thread.
 */
export interface AvatarFaceGeometry {
  /** Eye centers in the SVG's user units. */
  eyes: readonly [{ cx: number; cy: number }, { cx: number; cy: number }];
  /** Full-size eye dimensions. */
  w: number;
  h: number;
  /** Gaze travel for gaze = +-1. */
  travelX: number;
  travelY: number;
  /** Resting gaze offset and lean from `avatarRest`. */
  rest?: { x: number; y: number; lean: number };
  /** Bounce distance (user units) per unit of `bob`. Omit to keep the body still. */
  bob?: number;
}

export interface AvatarFaceFrame {
  leftD: string;
  rightD: string;
  /** Body translateY in user units. */
  bodyY: number;
  bodyScaleX: number;
  bodyScaleY: number;
}

/** Below this size gaze is frozen and the eyes only blink. */
export const MIN_ANIMATED_SIZE = 24;
export const MOOD_BLEND_MS = 220;

const COMPLETED_REACTION = { mood: "happy", ms: 1600 } as const;
const FAILED_REACTION = { mood: "sad", ms: 2000 } as const;

/** Short emote when a run leaves an active status, or undefined for no reaction. */
export function reactionForTransition(
  wasActive: boolean,
  status: string | undefined,
): { mood: AvatarMood; ms: number } | undefined {
  if (!wasActive) return undefined;
  if (status === "completed") return COMPLETED_REACTION;
  if (status === "failed") return FAILED_REACTION;
  return undefined;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Applies translate + rotate to an absolute `M..C..Z` eye path by moving its
 * points, so only the `d` prop animates (no transform prop on the UI thread).
 */
export function transformEyePath(d: string, tx: number, ty: number, degrees: number): string {
  "worklet";
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const nums = d.match(/-?\d*\.?\d+/g) ?? [];
  let out = "";
  let pair = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    const nx = r2(tx + x * cos - y * sin);
    const ny = r2(ty + x * sin + y * cos);
    // Command letter: M for the first point, C before each triple.
    if (pair === 0) out += "M";
    else if ((pair - 1) % 3 === 0) out += "C";
    else out += " ";
    out += `${nx} ${ny}`;
    pair += 1;
  }
  return `${out}Z`;
}

function eyeD(pose: AvatarEyePose, g: AvatarFaceGeometry, index: 0 | 1) {
  "worklet";
  const eye = g.eyes[index];
  const rest = g.rest ?? { x: 0, y: 0, lean: 0 };
  const tilt = (index === 0 ? pose.tilt : -pose.tilt) + rest.lean;
  return transformEyePath(
    avatarEyePath(g.w, g.h, pose),
    eye.cx + (pose.x + rest.x) * g.travelX,
    eye.cy + (pose.y + rest.y) * g.travelY,
    tilt,
  );
}

export function faceFrame(pose: AvatarFacePose, g: AvatarFaceGeometry): AvatarFaceFrame {
  "worklet";
  return {
    leftD: eyeD(pose.left, g, 0),
    rightD: eyeD(pose.right, g, 1),
    bodyY: pose.bob * (g.bob ?? 0),
    bodyScaleX: 1 - pose.squash * 0.6,
    bodyScaleY: 1 + pose.squash,
  };
}

const VISOR_BORDER_PX = 0;

/** Visor and eye sizes for the robot variant; same proportions as web's `robotFaceLayout`. */
export function robotFaceLayout(size: number) {
  const visorW = Math.round(size * 0.68);
  const visorH = Math.round(size * 0.44);
  const innerW = Math.max(0, visorW - VISOR_BORDER_PX * 2);
  const innerH = Math.max(0, visorH - VISOR_BORDER_PX * 2);
  const preferredEyeW = Math.max(4, Math.round(size * 0.14));
  const preferredEyeH = Math.max(7, Math.round(size * 0.22));
  const preferredGap = Math.max(3, Math.round(size * 0.1));
  const scale = Math.min(1, innerW / (preferredEyeW * 2 + preferredGap), innerH / preferredEyeH);
  const eyeW = Math.floor(preferredEyeW * scale);
  const eyeH = Math.floor(preferredEyeH * scale);
  const eyeGap = Math.floor(preferredGap * scale);
  return { visorW, visorH, innerW, innerH, eyeW, eyeH, eyeGap };
}
