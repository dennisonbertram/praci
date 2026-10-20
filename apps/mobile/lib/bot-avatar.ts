import type { ParsedBotAvatar } from "@rakazo/contracts";
import { parseBotAvatarValue } from "@rakazo/contracts";
import { resolvePersonaColorDef, shippedBotAvatarShapePath } from "@rakazo/core";

export type MobileBotAvatarPresentation =
  | Exclude<ParsedBotAvatar, { kind: "shape" }>
  | { kind: "shape"; color: string; shapeIndex: number; shapePath: string; eyeColor: string };

/** Resolve a stored `bots.color` value for native rendering, including shape paths. */
export function mobileBotAvatarPresentation(color: string): MobileBotAvatarPresentation {
  const parsed = parseBotAvatarValue(color);
  if (parsed.kind !== "shape") return parsed;
  return {
    ...parsed,
    shapePath: shippedBotAvatarShapePath(parsed.shapeIndex),
    eyeColor: resolvePersonaColorDef("preview", parsed.color).eyeColor,
  };
}

/** The stored avatar value after picking a colour: a shape is kept, an uploaded image is not overwritten. */
export function recolorBotAvatar(current: string, color: string): string {
  const parsed = parseBotAvatarValue(current);
  if (parsed.kind === "image") return current;
  return parsed.kind === "shape" ? `${color}::shape_${parsed.shapeIndex}` : color;
}
