import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FireIcon, PixelIcon } from "./pixel-icon";
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
