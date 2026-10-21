import { useState } from "react";

const SIZES = {
  sm: "size-5 rounded-md text-[10px]",
  row: "size-9 rounded-[9px] text-sm",
  md: "size-10 rounded-[10px] text-base",
  lg: "size-12 rounded-xl text-lg",
  xl: "size-14 rounded-[14px] text-xl",
} as const;

const SIMPLE_ICONS = "https://cdn.simpleicons.org/";

/** Simple Icons marks (CC0) vendored in public/logos/simple; the CDN is never requested. */
const BUNDLED = new Set([
  "box",
  "brex",
  "github",
  "gmail",
  "googlecalendar",
  "googledrive",
  "notion",
  "slack",
  "x",
]);

/** Local URL of a bundled Simple Icons mark, or null when the mark is not vendored. */
export function localLogoUrl(logo: string): string | null {
  if (!logo.startsWith(SIMPLE_ICONS)) return logo;
  const slug = logo.slice(SIMPLE_ICONS.length).split("/")[0] ?? "";
  return BUNDLED.has(slug) ? `/logos/simple/${slug}.svg` : null;
}

/** First letters of the first two words, so "Google Sheets" and "Gmail" differ. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
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
  const src = logo ? localLogoUrl(logo) : null;
  const showImage = Boolean(src) && !failed;
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
          src={src ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className={`size-[55%] object-contain ${mono ? "dark:invert" : ""}`}
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
