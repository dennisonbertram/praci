import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  ChartPie,
  Database,
  Laptop,
  MessageCircle,
  Mic,
  NotebookText,
  SquareTerminal,
} from "lucide-react";
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

/** Apps with no vendored mark get a glyph for what they do, never a letter that matches nothing. */
const GLYPHS: Record<string, LucideIcon> = {
  carta: ChartPie,
  treg: Database,
  devin: SquareTerminal,
  granola: NotebookText,
  wisprflow: Mic,
  imessageonyourmac: Laptop,
  imessage: MessageCircle,
};

/** Local URL of a bundled Simple Icons mark, or null when the mark is not vendored. */
export function localLogoUrl(logo: string): string | null {
  if (!logo.startsWith(SIMPLE_ICONS)) return logo;
  const slug = logo.slice(SIMPLE_ICONS.length).split("/")[0] ?? "";
  return BUNDLED.has(slug) ? `/logos/simple/${slug}.svg` : null;
}

/** App logo on a white tile. An app named after a bundled mark always gets that mark; with no usable logo, a known app a glyph, any other named app its initial. */
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
  // An app with a bundled mark always shows it, whichever source supplied a logo, so its tile never changes with connection state.
  const mark = BUNDLED.has(named) ? `${SIMPLE_ICONS}${named}` : logo;
  const src = mark ? localLogoUrl(mark) : null;
  const showImage = Boolean(src) && !failed;
  const Glyph = Object.entries(GLYPHS).find(([key]) => named.startsWith(key))?.[1];
  const initial = /^[\p{L}\p{N}]/u.test(name ?? "") ? (name ?? "").charAt(0).toUpperCase() : null;
  return (
    <span
      data-testid="app-logo"
      data-fallback={showImage ? undefined : "true"}
      className={`grid shrink-0 place-items-center overflow-hidden border border-border font-semibold ${SIZES[size]} ${
        showImage ? "bg-white" : "bg-muted text-muted-foreground"
      }`}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          className="size-[55%] object-contain"
          onError={() => setFailed(true)}
        />
      ) : Glyph ? (
        <Glyph aria-hidden="true" className="size-[55%]" />
      ) : initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <Blocks aria-hidden="true" className="size-[55%]" />
      )}
    </span>
  );
}
