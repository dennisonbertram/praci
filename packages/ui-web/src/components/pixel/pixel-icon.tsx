import type { CSSProperties } from "react";
import { PIXEL_COLORS, PIXEL_ICONS, type PixelSprite } from "./sprites";

type PixelIconProps = {
  sprite: PixelSprite;
  /** Rendered height in px; snapped down to a whole multiple of the box height. */
  size?: number;
  /** Decorative (aria-hidden) unless a label is given. */
  label?: string;
  /** False renders the first frame, still. Reduced-motion users get the same via CSS. */
  animate?: boolean;
  className?: string;
};

export function PixelIcon({ sprite, size = 16, label, animate = true, className }: PixelIconProps) {
  const first = sprite.frames[0] ?? [];
  const w = first[0]?.length ?? 0;
  const h = first.length;
  const box = sprite.box ?? { w, h };
  const scale = Math.max(1, Math.floor(size / box.h));
  const travel = box.w - w;
  const x = travel > 0 ? 0 : Math.floor(travel / 2);
  const y = box.h - h;
  const n = sprite.frames.length;
  const frameMs = sprite.frameMs ?? 500;
  const driveMs = sprite.driveMs ?? 2000;
  const run = animate && n > 1;
  const drive = animate && travel > 0;

  const sprites = (
    <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
      <g
        className={run ? "pixel-strip" : undefined}
        style={
          { "--frames": n, "--end": `${-n * w}px`, "--frame-dur": `${frameMs}ms` } as CSSProperties
        }
      >
        {sprite.frames.map((frame, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: frames are static and ordered
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
          <g className="pixel-flip">{sprites}</g>
        </g>
      ) : (
        sprites
      )}
    </svg>
  );
}

type IconProps = Omit<PixelIconProps, "sprite">;

export const FireTruckIcon = (props: IconProps) => (
  <PixelIcon sprite={PIXEL_ICONS.fireTruck} {...props} />
);
export const FireIcon = (props: IconProps) => <PixelIcon sprite={PIXEL_ICONS.fire} {...props} />;
