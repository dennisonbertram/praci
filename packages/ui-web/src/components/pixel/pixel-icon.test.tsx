import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FireIcon, PixelIcon, pixelPhase, STATUS_SPRITE, StatusIcon } from "./pixel-icon";
import { PIXEL_ICONS } from "./sprites";

const dot = { frames: [["rr", ".y"]] };

describe("PixelIcon", () => {
  it("renders one rect per coloured cell", () => {
    expect(renderToString(<PixelIcon sprite={dot} />).match(/<rect/g)).toHaveLength(3);
  });

  it("is decorative by default and an image with a label", () => {
    expect(renderToString(<PixelIcon sprite={dot} />)).toContain('aria-hidden="true"');
    const labelled = renderToString(<PixelIcon sprite={dot} label="Urgent" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Urgent"');
    expect(labelled).not.toContain("aria-hidden");
  });

  it("animates unless asked not to", () => {
    expect(renderToString(<FireIcon />)).toContain("pixel-strip");
    expect(renderToString(<FireIcon animate={false} />)).not.toContain("pixel-strip");
  });

  it("stops all pixel animation under prefers-reduced-motion", () => {
    const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.pixel-icon \* \{\s*animation: none/,
    );
  });

  it("has well-formed registered sprites", () => {
    for (const sprite of Object.values(PIXEL_ICONS)) {
      const sizes = new Set(sprite.frames.map((f) => `${f[0]?.length}x${f.length}`));
      expect(sizes.size).toBe(1);
      for (const f of sprite.frames) expect(new Set(f.map((r) => r.length)).size).toBe(1);
    }
  });
});

describe("PixelIcon movement", () => {
  it("only sprites with a drive time get the mover; the flame flickers in place", () => {
    expect(renderToString(<PixelIcon sprite={PIXEL_ICONS.fireTruck} />)).toContain("pixel-mover");
    expect(renderToString(<FireIcon />)).not.toContain("pixel-mover");
  });
});

describe("PixelIcon size", () => {
  it("renders the requested height, including below the box height", () => {
    expect(renderToString(<FireIcon size={8} />)).toContain('height="8"');
    expect(renderToString(<FireIcon size={32} />)).toContain('height="32"');
  });
});

describe("PixelIcon desync", () => {
  it("gives different seeds different phases, the same seed the same phase", () => {
    const ids = ["bot-a", "bot-b", "bot-c", "bot-d", "bot-e"];
    expect(new Set(ids.map((id) => pixelPhase(id).phase)).size).toBe(ids.length);
    expect(pixelPhase("bot-a")).toEqual(pixelPhase("bot-a"));
    for (const id of ids) {
      const { phase, speed } = pixelPhase(id);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
      expect(speed).toBeGreaterThanOrEqual(0.9);
      expect(speed).toBeLessThanOrEqual(1.1);
    }
  });

  it("renders the phase as CSS variables, stable across renders, and none without a seed", () => {
    const a = renderToString(<FireIcon seed="bot-a" />);
    expect(a).toContain("--pixel-phase");
    expect(renderToString(<FireIcon seed="bot-a" />)).toBe(a);
    expect(renderToString(<FireIcon seed="bot-b" />)).not.toBe(a);
    expect(renderToString(<FireIcon />)).not.toContain("--pixel-phase");
  });

  it("delays every animation by a negative, phase-based amount", () => {
    const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    for (const name of ["pixel-strip", "pixel-mover", "pixel-flip"]) {
      const rule = new RegExp(`\\.${name} \\{[^}]*animation-delay: calc\\([^}]*\\* -1\\)`);
      expect(css).toMatch(rule);
    }
  });
});

describe("status icons", () => {
  it("has a sprite for every kind, and each one animates", () => {
    expect(Object.keys(STATUS_SPRITE)).toEqual(["urgent", "needs_input", "failed", "done", "new"]);
    for (const kind of Object.keys(STATUS_SPRITE) as (keyof typeof STATUS_SPRITE)[]) {
      expect(renderToString(<StatusIcon kind={kind} />)).toContain("pixel-strip");
      // Reduced motion removes the animation, which leaves the first frame showing.
      expect(renderToString(<StatusIcon kind={kind} animate={false} />)).not.toContain(
        "pixel-strip",
      );
    }
  });
});
