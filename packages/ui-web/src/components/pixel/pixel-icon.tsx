import type { CSSProperties } from "react";
import type { PixelSprite } from "./sprites";
import { PIXEL_COLORS, PIXEL_ICONS } from "./sprites";

type PixelIconProps = {
  sprite: PixelSprite;
  /** Rendered height in px. At or above the box height it snaps down to a whole multiple; below it, the sprite is scaled down to fit. */
  size?: number;
  /** Decorative (aria-hidden) unless a label is given. */
  label?: string;
  /** False renders the first frame, still. Reduced-motion users get the same via CSS. */
  animate?: boolean;
  className?: string;
  /** Gives this instance its own animation phase and speed (e.g. an agent id), so a list does not move in lockstep. Same seed, same phase on every render. */
  seed?: string;
};

/** FNV-1a: a stable 32-bit hash of the seed. */
function hash(seed: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Where in its cycle (0 to 1) and how fast (0.9 to 1.1x) a seeded icon animates. */
export function pixelPhase(seed: string) {
  const h = hash(seed);
  return { phase: (h % 1000) / 1000, speed: 0.9 + ((h >>> 10) % 201) / 1000 };
}

export function PixelIcon({
  sprite,
  size = 16,
  label,
  animate = true,
  className,
  seed,
}: PixelIconProps) {
  const first = sprite.frames[0] ?? [];
  const w = first[0]?.length ?? 0;
  const h = first.length;
  const box = sprite.box ?? { w, h };
  const scale = size >= box.h ? Math.floor(size / box.h) : size / box.h;
  const travel = box.w - w;
  const x = sprite.driveMs !== undefined ? 0 : Math.floor(travel / 2);
  const y = box.h - h;
  const n = sprite.frames.length;
  const frameMs = sprite.frameMs ?? 500;
  const run = animate && n > 1;
  const driveMs = sprite.driveMs;
  const drive = animate && driveMs !== undefined && travel > 0;

  const sprites = (
    <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
      <g
        className={run ? "pixel-strip" : undefined}
        style={
          { "--frames": n, "--end": `${-n * w}px`, "--frame-dur": `${frameMs}ms` } as CSSProperties
        }
      >
        {sprite.frames.map((frame, i) => (
          <g key={i} transform={`translate(${i * w} 0)`}>
            {frame.flatMap((row, py) =>
              [...row].map((c, px) =>
                PIXEL_COLORS[c] ? (
                  <rect
                    key={`${px}-${py}`}
                    x={px}
                    y={py}
                    width={1}
                    height={1}
                    style={{ fill: PIXEL_COLORS[c] }}
                  />
                ) : null,
              ),
            )}
          </g>
        ))}
      </g>
    </svg>
  );

  return (
    <svg
      className={["pixel-icon", className].filter(Boolean).join(" ")}
      width={box.w * scale}
      height={box.h * scale}
      viewBox={`0 0 ${box.w} ${box.h}`}
      shapeRendering="crispEdges"
      style={
        seed
          ? ({
              "--pixel-phase": pixelPhase(seed).phase,
              "--pixel-speed": pixelPhase(seed).speed,
            } as CSSProperties)
          : undefined
      }
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {drive ? (
        <g
          className="pixel-mover"
          style={
            {
              "--travel": `${travel}px`,
              "--travel-steps": travel,
              "--drive-dur": `${driveMs}ms`,
            } as CSSProperties
          }
        >
          <g className="pixel-flip" style={{ transformOrigin: `${x + w / 2}px 0` }}>
            {sprites}
          </g>
        </g>
      ) : (
        sprites
      )}
    </svg>
  );
}

type IconProps = Omit<PixelIconProps, "sprite">;

/** The sprite for each notification kind, in the order of priority. */
export const STATUS_SPRITE = {
  urgent: PIXEL_ICONS.fireTruck,
  needs_input: PIXEL_ICONS.needsInput,
  failed: PIXEL_ICONS.failed,
  done: PIXEL_ICONS.done,
  new: PIXEL_ICONS.sparkle,
} as const;

export const FireTruckIcon = (props: IconProps) => (
  <PixelIcon sprite={PIXEL_ICONS.fireTruck} {...props} />
);
export const StatusIcon = ({
  kind,
  ...props
}: IconProps & { kind: keyof typeof STATUS_SPRITE }) => (
  <PixelIcon sprite={STATUS_SPRITE[kind]} {...props} />
);
export const FireIcon = (props: IconProps) => <PixelIcon sprite={PIXEL_ICONS.fire} {...props} />;
