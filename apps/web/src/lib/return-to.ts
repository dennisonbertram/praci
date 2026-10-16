/**
 * A same-origin path under `/app` that a page may send the person back to, or null. Used for
 * `?next=` so a link can never bounce someone to another site or to a page outside the app.
 */
export function appReturnPath(value: string | null | undefined): string | null {
  // Backslashes and control characters are read as "/" by some browsers, so refuse them outright.
  if (!value?.startsWith("/app") || [...value].some((c) => c === "\\" || c < " " || c === "\x7f")) {
    return null;
  }
  // Encoded control characters are never legitimate. Encoded dots are traversal only in the path;
  // a query value (such as a nested `next`) may contain them.
  if (/%(?:[01][0-9a-f]|7f)/i.test(value)) return null;
  if (/%2e/i.test(value.split(/[?#]/, 1)[0] ?? "")) return null;
  try {
    const base = "http://return.invalid";
    const url = new URL(value, base);
    const inApp = url.pathname === "/app" || url.pathname.startsWith("/app/");
    return url.origin === base && inApp ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
