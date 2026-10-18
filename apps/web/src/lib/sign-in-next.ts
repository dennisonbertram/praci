/** Where sign-in returns to: an in-app path from `next=`, never another origin. */
export function signInNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/app";
  const path = raw.split(/[?#]/, 1)[0] ?? "";
  if (path === "/integrations/setup" || path === "/app" || path.startsWith("/app/")) return raw;
  return "/app";
}

/** The sign-in URL that brings the user back to `path` (with its query) afterwards. */
export function signInFor(path: string): string {
  const next = signInNext(path);
  return next === "/app" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}
