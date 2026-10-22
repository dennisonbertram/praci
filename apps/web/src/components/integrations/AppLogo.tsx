import { Blocks } from "lucide-react";
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
  "airtable",
  "box",
  "brex",
  "github",
  "gmail",
  "googlecalendar",
  "googledrive",
  "linear",
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

/** App logo on a neutral tile. With no usable logo, an app named after a bundled mark gets that mark, any other named app its initial, so no two apps look alike. */
export function AppLogo({
  name,
  logo,
  size = "md",
}: {
  name?: string;
  logo?: string | null;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const named = (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const simple = logo ? null : BUNDLED.has(named) ? `${SIMPLE_ICONS}${named}` : null;
  const mark = logo ?? simple;
  const src = mark ? localLogoUrl(mark) : null;
  const showImage = Boolean(src) && !failed;
  const mono = Boolean(mark?.startsWith(SIMPLE_ICONS));
  const initial = /^[\p{L}\p{N}]/u.test(name ?? "") ? (name ?? "").charAt(0).toUpperCase() : null;
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
          decoding="async"
          className={`size-[55%] object-contain ${mono ? "dark:invert" : ""}`}
          onError={() => setFailed(true)}
        />
      ) : initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <Blocks aria-hidden="true" className="size-[55%]" />
      )}
    </span>
  );
}
