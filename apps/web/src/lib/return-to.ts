/**
 * A same-origin path under `/app` that a page may send the person back to, or null. Used for
 * `?next=` so a link can never bounce someone to another site or to a page outside the app.
 */
export function appReturnPath(value: string | null | undefined): string | null {
  // Backslashes and control characters are read as "/" by some browsers, so refuse them outright.
  if (!value?.startsWith("/app") || [...value].some((c) => c === "\\" || c < " " || c === "\x7f")) {
    return null;
  }
  // Encoded dots (path traversal) and encoded control characters are never legitimate here.
  if (/%(?:2e|[01][0-9a-f]|7f)/i.test(value)) return null;
  try {
    const base = "http://return.invalid";
    const url = new URL(value, base);
    const inApp = url.pathname === "/app" || url.pathname.startsWith("/app/");
    return url.origin === base && inApp ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
