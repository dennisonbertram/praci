import type { AvatarMood, GrokColorDef } from "@rakazo/core";
import {
  ACTIVE_RUN_STATUSES,
  AVATAR_GAZE_TRAVEL,
  avatarIdentitySeed,
  avatarReactionForTransition,
  avatarRest,
  avatarShapeGazeTravel,
  DEFAULT_GROK_BOT_COLOR,
  GROK_BOT_COLORS,
  GROK_COLOR_LIST,
  moodForRunStatus,
  organicAvatarPath,
  resolvePersonaColorDef,
  SHIPPED_BOT_AVATAR_CENTER,
  SHIPPED_BOT_AVATAR_SHAPE_KEYS,
  SHIPPED_BOT_AVATAR_SHAPES,
  SHIPPED_BOT_AVATAR_VIEWBOX,
  shippedBotAvatarShapePath,
  shippedHash,
} from "@rakazo/core";
import { tokens } from "@rakazo/ui-tokens";
import type { CSSProperties } from "react";
import { memo, useEffect, useId, useMemo, useRef } from "react";
import type { AvatarStyle } from "./avatar-style.js";
import { useAvatarStyle } from "./avatar-style.js";
import { cn } from "./lib/utils.js";
import type { AvatarFaceGeometry } from "./use-avatar-face.js";
import { useAvatarFace, useAvatarReaction, useReducedMotion } from "./use-avatar-face.js";
import "./styles.css";

export type { GrokColorDef };
export {
  DEFAULT_GROK_BOT_COLOR,
  GROK_BOT_COLORS,
  GROK_COLOR_LIST,
  resolvePersonaColorDef,
  useAvatarReaction,
};

export const GROK_SHAPES = SHIPPED_BOT_AVATAR_SHAPES;
export const SHIPPED_SHAPE_KEYS = SHIPPED_BOT_AVATAR_SHAPE_KEYS;
const VIEWBOX = SHIPPED_BOT_AVATAR_VIEWBOX;
const CENTER = SHIPPED_BOT_AVATAR_CENTER;

export const GROK_MASCOT_SHAPES = SHIPPED_SHAPE_KEYS.map(
  (k) => GROK_SHAPES[k] ?? FALLBACK_SHAPE_PATH,
);

const FALLBACK_SHAPE_PATH = GROK_SHAPES.hex ?? "";

const DEFAULT_BOT_COLOR = "#F97316";

/** Spinning glow ring shown around a working avatar. */
function WorkingRing({ id, size, light }: { id: string; size: number; light: string }) {
  return (
    <svg
      className="rakazo-bot-avatar-ring pointer-events-none absolute"
      style={{
        inset: -4,
        width: size + 8,
        height: size + 8,
        filter: `drop-shadow(0 0 6px ${light}) drop-shadow(0 0 10px #ffffff)`,
      }}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="22"
        stroke={`url(#${id}-ring)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray="45 80"
      />
      <circle cx="43" cy="24" r="2.8" fill="#ffffff" />
      <defs>
        <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="60%" stopColor={light} stopOpacity="0.9" />
          <stop offset="100%" stopColor={light} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function resolvePersonaShape(identity: string, explicitShape?: string | null): string {
  if (explicitShape) {
    const explicit = GROK_SHAPES[explicitShape];
    if (explicit) return explicit;
  }
  let hash = shippedHash(identity);
  hash = Math.imul(hash ^ (hash >>> 16), 73244475);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  const shapeIndex = ((hash ^ (hash >>> 16)) >>> 0) % SHIPPED_SHAPE_KEYS.length;
  const key = SHIPPED_SHAPE_KEYS[shapeIndex] ?? "hex";
  return GROK_SHAPES[key] ?? FALLBACK_SHAPE_PATH;
}

export function parseBotAvatar(
  rawColor: string,
  _identity?: string,
): {
  color: string;
  shapeIndex?: number;
  isImage: boolean;
  imageUrl?: string;
} {
  if (!rawColor) return { color: DEFAULT_BOT_COLOR, isImage: false };
  // Only data: image URLs are rendered. Arbitrary http(s)/blob values in `color`
  // must not become <img src> (SSRF / tracking when other members view the bot).
  if (rawColor.startsWith("data:image/")) {
    return { color: DEFAULT_BOT_COLOR, isImage: true, imageUrl: rawColor };
  }
  if (rawColor.includes("::shape_")) {
    const parts = rawColor.split("::shape_");
    const rawShapeIdx = parts[1] ?? "0";
    const parsedShapeIdx = /^\d+$/.test(rawShapeIdx) ? Number(rawShapeIdx) : 0;
    const shapeIdx = Number.isSafeInteger(parsedShapeIdx) ? parsedShapeIdx : 0;
    return {
      color: parts[0] || DEFAULT_BOT_COLOR,
      shapeIndex: shapeIdx % SHIPPED_SHAPE_KEYS.length,
      isImage: false,
    };
  }
  return { color: rawColor, isImage: false };
}

const AVATAR_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function defaultBotAvatarValue(rawColor: string): string {
  const parsed = parseBotAvatar(rawColor);
  if (rawColor && !parsed.isImage && AVATAR_HEX.test(parsed.color)) return parsed.color;
  return DEFAULT_GROK_BOT_COLOR;
}

export interface BotAvatarProps {
  color: string;
  size?: number;
  status?: string;
  identity?: string;
  className?: string;
  variant?: AvatarStyle;
  /** Overrides the mood derived from `status`. */
  mood?: AvatarMood;
  /** Gaze target, -1..1 on each axis. */
  lookAt?: { x: number; y: number };
}

export const BotAvatar = memo(function BotAvatar({
  color,
  size = 36,
  status,
  identity = "",
  className,
  variant,
  mood: moodProp,
  lookAt,
}: BotAvatarProps) {
  const id = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const isWorking = ACTIVE_RUN_STATUSES.some((s) => s === status);
  const [reaction, react] = useAvatarReaction();
  const previousStatus = useRef(status);
  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = status;
    const next = avatarReactionForTransition(was, status);
    if (next) react(next.mood, next.ms);
  }, [status, react]);
  const mood = moodProp ?? reaction ?? moodForRunStatus(status);
  const preferredVariant = useAvatarStyle();

  const parsed = useMemo(() => parseBotAvatar(color, identity), [color, identity]);
  const effectiveId = identity || parsed.color || "agent";

  const colorDef = useMemo(
    () => resolvePersonaColorDef(effectiveId, parsed.color),
    [effectiveId, parsed.color],
  );

  const shapePath = useMemo(() => {
    if (parsed.shapeIndex !== undefined) {
      return shippedBotAvatarShapePath(parsed.shapeIndex);
    }
    return resolvePersonaShape(effectiveId);
  }, [parsed.shapeIndex, effectiveId]);

  if (parsed.isImage && parsed.imageUrl) {
    return (
      <div
        className={cn("rakazo-bot-avatar relative shrink-0 select-none", className)}
        data-working={isWorking}
        style={{ width: size, height: size }}
      >
        <div className="rakazo-bot-avatar-picture relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
          <img src={parsed.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
        {isWorking ? (
          <svg
            className="rakazo-bot-avatar-ring rakazo-bot-avatar-ring-working absolute z-10 pointer-events-none"
            style={{
              inset: -4,
              width: size + 8,
              height: size + 8,
            }}
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="24"
              cy="24"
              r="22"
              className="stroke-status-working"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray="45 80"
            />
          </svg>
        ) : null}
      </div>
    );
  }

  if (parsed.shapeIndex === undefined && (variant ?? preferredVariant) === "organic") {
    return (
      <OrganicAvatar
        color={colorDef.hex}
        identity={effectiveId}
        size={size}
        isWorking={isWorking}
        className={className}
        mood={mood}
        lookAt={lookAt}
      />
    );
  }

  if (parsed.shapeIndex === undefined) {
    return (
      <RobotAvatar
        colorDef={colorDef}
        size={size}
        isWorking={isWorking}
        className={className}
        identity={effectiveId}
        gradientId={id}
        mood={mood}
        lookAt={lookAt}
      />
    );
  }

  return (
    <ShapeAvatar
      colorDef={colorDef}
      shapePath={shapePath}
      size={size}
      isWorking={isWorking}
      className={className}
      id={id}
      seed={avatarIdentitySeed(effectiveId)}
      shapeIndex={parsed.shapeIndex ?? 0}
      mood={mood}
      lookAt={lookAt}
    />
  );
});

/** Dark tall pills, about 8% x 25% of the viewBox, the pair spanning 40% of the body. */
const SHAPE_EYE = { w: 20, h: 62, dx: 34, dy: 12 };

function ShapeAvatar({
  colorDef,
  shapePath,
  size,
  isWorking,
  className,
  id,
  seed,
  shapeIndex,
  mood,
  lookAt,
}: {
  colorDef: GrokColorDef;
  shapePath: string;
  shapeIndex: number;
  size: number;
  isWorking: boolean;
  className?: string;
  id: string;
  seed: number;
  mood: AvatarMood;
  lookAt?: { x: number; y: number };
}) {
  const geometry: AvatarFaceGeometry = {
    eyes: [
      { cx: CENTER - SHAPE_EYE.dx, cy: CENTER + SHAPE_EYE.dy },
      { cx: CENTER + SHAPE_EYE.dx, cy: CENTER + SHAPE_EYE.dy },
    ],
    w: SHAPE_EYE.w,
    h: SHAPE_EYE.h,
    travelX: avatarShapeGazeTravel(shapeIndex).x,
    travelY: avatarShapeGazeTravel(shapeIndex).y,
    rest: avatarRest(seed),
    body: { cx: CENTER, cy: CENTER, bob: 20 },
  };
  const face = useAvatarFace({ seed, mood, size, geometry, lookAt });

  return (
    <div
      className={cn(
        "rakazo-bot-avatar grok-avatar-container relative inline-flex items-center justify-center shrink-0 select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
      }}
      data-working={isWorking}
      data-mood={mood}
    >
      <WorkingRing id={id} size={size} light={colorDef.light} />
      <svg
        viewBox={VIEWBOX}
        width={size}
        height={size}
        aria-hidden="true"
        className={cn(
          "overflow-visible transition-transform duration-300",
          isWorking
            ? "animate-pulse scale-[1.04] motion-reduce:animate-none"
            : "hover:scale-[1.03] motion-reduce:hover:scale-100",
        )}
        style={{
          filter: isWorking
            ? `drop-shadow(0 0 8px ${colorDef.light}) drop-shadow(0 0 2px #ffffff)`
            : "drop-shadow(0 2px 4px rgba(0,0,0,0.45))",
        }}
      >
        <defs>
          <linearGradient id={`grok-ink-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colorDef.light} />
            <stop offset="100%" stopColor={colorDef.dark} />
          </linearGradient>
        </defs>
        <g ref={face.bodyRef} transform={face.initial.body}>
          <path d={shapePath} fill={`url(#grok-ink-${id})`} />
          <g fill={tokens.background} className="grok-character-eyes">
            <path ref={face.leftRef} {...face.initial.left} />
            <path ref={face.rightRef} {...face.initial.right} />
          </g>
        </g>
      </svg>
    </div>
  );
}

const VISOR_BORDER_PX = 1;

export function robotFaceLayout(size: number) {
  const visorW = Math.round(size * 0.68);
  const visorH = Math.round(size * 0.44);
  const visorInnerW = Math.max(0, visorW - VISOR_BORDER_PX * 2);
  const visorInnerH = Math.max(0, visorH - VISOR_BORDER_PX * 2);
  const preferredEyeW = Math.max(4, Math.round(size * 0.14));
  const preferredEyeH = Math.max(7, Math.round(size * 0.22));
  const preferredEyeGap = Math.max(3, Math.round(size * 0.1));
  const preferredSpan = preferredEyeW * 2 + preferredEyeGap;
  const scale = Math.min(1, visorInnerW / preferredSpan, visorInnerH / preferredEyeH);
  const eyeW = Math.floor(preferredEyeW * scale);
  const eyeH = Math.floor(preferredEyeH * scale);
  const eyeGap = Math.floor(preferredEyeGap * scale);
  const eyeRadius = Math.max(2, Math.round(eyeW * 0.5));
  return { visorW, visorH, eyeW, eyeH, eyeGap, eyeRadius };
}

function RobotAvatar({
  colorDef,
  size,
  isWorking,
  className,
  identity,
  gradientId,
  mood,
  lookAt,
}: {
  colorDef: GrokColorDef;
  size: number;
  isWorking: boolean;
  className?: string;
  identity: string;
  gradientId: string;
  mood: AvatarMood;
  lookAt?: { x: number; y: number };
}) {
  const seed = avatarIdentitySeed(identity || colorDef.hex);
  const { visorW, visorH, eyeW, eyeH, eyeGap } = robotFaceLayout(size);
  const innerW = visorW - VISOR_BORDER_PX * 2;
  const innerH = visorH - VISOR_BORDER_PX * 2;
  const centerX = innerW / 2;
  const centerY = innerH / 2;
  const geometry: AvatarFaceGeometry = {
    eyes: [
      { cx: centerX - (eyeGap + eyeW) / 2, cy: centerY },
      { cx: centerX + (eyeGap + eyeW) / 2, cy: centerY },
    ],
    w: eyeW,
    h: eyeH,
    travelX: Math.max(0, (innerW - eyeW * 2 - eyeGap) / 2) * AVATAR_GAZE_TRAVEL.robot.x,
    travelY: Math.max(0, (innerH - eyeH) / 2) * AVATAR_GAZE_TRAVEL.robot.y,
    visorRotate: 0.6,
  };
  const face = useAvatarFace({ seed, mood, size, geometry, lookAt });
  const eyeGlow = `drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 ${Math.max(2, size * 0.1)}px ${colorDef.light})`;

  return (
    <div
      className={cn(
        "rakazo-bot-avatar relative inline-flex shrink-0 items-center justify-center rounded-full select-none",
        className,
      )}
      data-working={isWorking}
      data-mood={mood}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 26%, ${colorDef.light}, ${colorDef.hex} 55%, ${colorDef.dark} 100%)`,
        boxShadow: isWorking
          ? `0 0 0 2px rgba(255,255,255,0.25), 0 0 ${Math.round(size * 0.45)}px ${colorDef.hex}`
          : `0 2px ${Math.max(4, Math.round(size * 0.15))}px rgba(0,0,0,0.4)`,
      }}
    >
      <WorkingRing id={gradientId} size={size} light={colorDef.light} />
      <div
        ref={face.visorRef}
        className="rakazo-bot-avatar-visor relative flex items-center justify-center overflow-hidden"
        style={{
          transform: face.initial.visor,
          width: visorW,
          height: visorH,
          boxSizing: "border-box",
          borderRadius: Math.round(visorH * 0.52),
          background: "linear-gradient(180deg, #101014 0%, #030305 100%)",
          boxShadow: "inset 0 1.5px 3px rgba(0,0,0,0.95), 0 1px 1px rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <svg
          className="rakazo-bot-avatar-eyes absolute inset-0 z-10 overflow-visible"
          width="100%"
          height="100%"
          viewBox={`0 0 ${innerW} ${innerH}`}
          fill="#fff"
          style={{ filter: eyeGlow }}
          aria-hidden="true"
        >
          <path ref={face.leftRef} {...face.initial.left} />
          <path ref={face.rightRef} {...face.initial.right} />
        </svg>
      </div>
    </div>
  );
}

const ORGANIC_FACE: AvatarFaceGeometry = {
  eyes: [
    { cx: -10.5, cy: 0 },
    { cx: 10.5, cy: 0 },
  ],
  w: 7,
  h: 24,
  travelX: AVATAR_GAZE_TRAVEL.organic.x,
  travelY: AVATAR_GAZE_TRAVEL.organic.y,
  body: { cx: 0, cy: 0, bob: 10 },
};

function OrganicAvatar({
  color,
  identity,
  size,
  isWorking,
  className,
  mood,
  lookAt,
}: {
  color: string;
  identity?: string;
  size: number;
  isWorking: boolean;
  className?: string;
  mood: AvatarMood;
  lookAt?: { x: number; y: number };
}) {
  const reducedMotion = useReducedMotion();
  const seed = avatarIdentitySeed(identity || color || DEFAULT_GROK_BOT_COLOR);
  const duration = `${4.8 + (seed % 24) / 10}s`;
  const shapeA = organicAvatarPath(seed);
  const shapeB = organicAvatarPath(seed, 0.42);
  const face = useAvatarFace({
    seed,
    mood,
    size,
    geometry: {
      ...ORGANIC_FACE,
      rest: avatarRest(seed),
      // The working CSS animation already moves the body.
      body: isWorking ? undefined : ORGANIC_FACE.body,
    },
    lookAt,
  });

  return (
    <svg
      viewBox="-60 -60 120 120"
      aria-hidden="true"
      className={cn("rakazo-organic-avatar overflow-visible select-none", className)}
      data-working={isWorking}
      data-mood={mood}
      data-shape-family={seed % 10}
      style={{
        width: size,
        height: size,
        flex: "none",
      }}
    >
      <g ref={face.bodyRef} transform={face.initial.body}>
        {(["idle", "working"] as const).map((mode) => (
          <path
            key={mode}
            className={`rakazo-organic-avatar-body rakazo-organic-avatar-body-${mode}`}
            d={shapeA}
            fill={color}
            style={
              {
                "--rakazo-organic-path": `path("${shapeA}")`,
                filter:
                  mode === "working"
                    ? `drop-shadow(0 0 ${Math.round(size * 0.16)}px ${color})`
                    : "drop-shadow(0 2px 3px rgba(0,0,0,.34))",
              } as CSSProperties
            }
          >
            {!reducedMotion ? (
              <animate
                attributeName="d"
                values={`${shapeA};${shapeB};${shapeA}`}
                dur={duration}
                repeatCount="indefinite"
              />
            ) : null}
          </path>
        ))}
        <g
          className={`rakazo-organic-avatar-body rakazo-organic-avatar-body-${isWorking ? "working" : "idle"}`}
        >
          <g transform={`rotate(${(seed % 9) - 4})`} fill={tokens.background}>
            <path ref={face.leftRef} {...face.initial.left} />
            <path ref={face.rightRef} {...face.initial.right} />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function GrokShapePreview({
  shapeIndex,
  color,
  selected,
  onClick,
}: {
  shapeIndex: number;
  color: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const key = SHIPPED_SHAPE_KEYS[shapeIndex % SHIPPED_SHAPE_KEYS.length] ?? "hex";
  const path = shippedBotAvatarShapePath(shapeIndex);
  const colorDef = resolvePersonaColorDef("preview", color);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={key}
      aria-pressed={selected ?? false}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-popover bg-white/10"
          : "hover:bg-white/5",
      )}
    >
      <svg viewBox={VIEWBOX} className="size-8 overflow-visible" aria-hidden="true">
        <path d={path} fill={colorDef.light} />
        <g fill={colorDef.eyeColor}>
          <ellipse cx={CENTER - 29} cy={CENTER - 8} rx={10} ry={7} />
          <ellipse cx={CENTER + 29} cy={CENTER - 8} rx={10} ry={7} />
        </g>
      </svg>
    </button>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full bg-card">
        <span className="h-4 w-[7px] rounded-full bg-primary" />
        <span className="h-4 w-[7px] rounded-full bg-primary" />
      </div>
      <span className="font-[Aeonik,ui-sans-serif] text-[28px] tracking-tight text-foreground">
        Praci
      </span>
    </div>
  );
}
