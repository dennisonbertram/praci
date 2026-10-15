import { useState } from "react";

const SIZES = {
  sm: "size-5 rounded-md text-[10px]",
  md: "size-10 rounded-[10px] text-base",
  lg: "size-12 rounded-xl text-lg",
  xl: "size-14 rounded-[14px] text-xl",
} as const;

const SIMPLE_ICONS = "https://cdn.simpleicons.org/";

/**
 * Simple Icons marks default to the brand color, which can be black and vanish on a dark tile.
 * Request an explicit black glyph (the hex is a CDN color parameter, not a product color) and
 * invert it in dark mode, so the mark stays legible on the themed tile in both themes.
 */
export function themedLogoUrl(logo: string): string {
  if (!logo.startsWith(SIMPLE_ICONS)) return logo;
  const rest = logo.slice(SIMPLE_ICONS.length);
  return rest.includes("/") ? logo : `${SIMPLE_ICONS}${rest}/000000`;
}

/** App logo on a neutral tile; a missing or broken image falls back to the app's first letter. */
export function AppLogo({
  name,
  logo,
  size = "md",
}: {
  name: string;
  logo?: string | null;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logo) && !failed;
  const mono = Boolean(logo?.startsWith(SIMPLE_ICONS));
  return (
    <span
      data-testid="app-logo"
      data-fallback={showImage ? undefined : "true"}
      className={`grid shrink-0 place-items-center overflow-hidden border border-border font-semibold ${SIZES[size]} ${
        showImage && !mono ? "bg-white" : "bg-muted text-muted-foreground"
      }`}
    >
      {showImage ? (
        <img
          src={logo ? themedLogoUrl(logo) : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className={`size-[55%] object-contain ${mono ? "dark:invert" : ""}`}
          onError={() => setFailed(true)}
        />
      ) : (
        (name.trim()[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}
