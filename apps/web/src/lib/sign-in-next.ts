import { appReturnPath } from "./return-to";

/** Where sign-in returns to: an in-app path from `next=`, never another origin. */
export function signInNext(raw: string | null): string {
  // The setup page is the one non-/app target; its tail gets the same checks as an /app path.
  const setup = "/integrations/setup";
  const tail = raw?.startsWith(setup) ? raw.slice(setup.length) : null;
  if (raw && tail !== null && (tail === "" || /^[?#]/.test(tail)) && appReturnPath(`/app${tail}`)) {
    return raw;
  }
  return appReturnPath(raw) ?? "/app";
}

/** The sign-in URL that brings the user back to `path` (with its query) afterwards. */
export function signInFor(path: string): string {
  const next = signInNext(path);
  return next === "/app" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}
