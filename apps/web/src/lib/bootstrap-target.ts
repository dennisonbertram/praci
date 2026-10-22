export function initialBootstrapTarget(pathname: string, desktop: boolean) {
  const appRoute = pathname === "/app" || pathname.startsWith("/app/");
  if (!appRoute && !(desktop && pathname === "/")) return null;
  return { botId: appRoute ? botIdFromPath(pathname) : undefined };
}

// The /app/<segment> routes in App.tsx that are pages, not agents; their bootstrap has no bot.
const PAGE_SEGMENTS = new Set([
  "g",
  "artifacts",
  "board",
  "inbox",
  "integrations",
  "finance",
  "legal",
  "gtm",
  "devin",
  "data-room",
  "investors",
  "fundraising",
  "cap-table",
  "contacts",
]);

function botIdFromPath(pathname: string) {
  const segments = pathname.split("/");
  const encoded = segments[2];
  if (encoded && PAGE_SEGMENTS.has(encoded)) return undefined;
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}
