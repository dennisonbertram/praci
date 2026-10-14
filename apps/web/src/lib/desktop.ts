import type { RakazoDesktop, RakazoDesktopOAuthCallback } from "@rakazo/contracts";

export type { RakazoDesktop, RakazoDesktopOAuthCallback } from "@rakazo/contracts";

declare global {
  interface Window {
    rakazoDesktop?: RakazoDesktop;
  }
}

export function desktopBridge(): RakazoDesktop | undefined {
  return typeof window === "undefined" ? undefined : window.rakazoDesktop;
}

/** The compact `code#state` form the manual paste flow already accepts. */
export function desktopOAuthCode(callback: RakazoDesktopOAuthCallback) {
  return callback.state === undefined ? callback.code : `${callback.code}#${callback.state}`;
}

/**
 * The authorize URL carries the attempt's PKCE state, so a captured code whose
 * state differs belongs to a different attempt — a popup left open by a
 * cancelled sign-in, say — and must not be spent on the current one.
 */
export function oauthStateOf(verificationUri: string): string | undefined {
  try {
    return new URL(verificationUri).searchParams.get("state") ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Desktop sign-in redirects to a loopback URL the renderer never sees.
 * The main process captures the code there so the browser flow's
 * copy-and-paste step can be skipped. No-ops in a browser.
 *
 * Pass the attempt's state to ignore codes captured for any other attempt.
 * Providers whose authorize URL carries no state cannot be correlated, so
 * their codes are accepted as before.
 */
export function onDesktopOAuthCallback(
  listener: (code: string) => void,
  expectedState?: string,
): () => void {
  const oauth = desktopBridge()?.oauth;
  if (!oauth) return () => undefined;
  return oauth.onCallback((callback) => {
    if (expectedState !== undefined && callback.state !== expectedState) return;
    listener(desktopOAuthCode(callback));
  });
}

export function windowChromeKind(desktop?: RakazoDesktop): "spacer" | "darwin" | "controls" {
  if (!desktop) return "spacer";
  if (desktop.platform === "darwin") return "darwin";
  return "controls";
}

/**
 * Google refuses sign-in inside Electron's embedded browser, so native Google is offered on
 * desktop only when the shell can open the system browser and catch the loopback redirect.
 */
export function nativeGoogleAvailable(desktop: RakazoDesktop | undefined): boolean {
  return !desktop || Boolean(desktop.oauth.open);
}

const SYSTEM_BROWSER_SIGN_IN_TIMEOUT_MS = 5 * 60_000;

/**
 * Opens the authorization URL in the system browser and resolves with the code that comes back to
 * the shell's one-shot loopback listener. The listener checks `state` too; the renderer repeats the
 * check so a stale tab cannot hand its code to this attempt. The caller finishes the exchange with
 * the user's session (`connections.complete`), since the system browser has none.
 */
export function signInWithSystemBrowser(
  authorizationUrl: string,
  signal: AbortSignal,
): Promise<{ code: string; state: string }> {
  const oauth = desktopBridge()?.oauth;
  const state = oauthStateOf(authorizationUrl);
  if (!oauth?.open || !state) return Promise.reject(new Error("Browser sign-in is unavailable."));
  const open = oauth.open;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (settle: () => void, cancel: boolean) => {
      if (done) return;
      done = true;
      unsubscribe();
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      if (cancel) void oauth.cancel?.(authorizationUrl).catch(() => undefined);
      settle();
    };
    const onAbort = () => finish(() => reject(new Error("Sign-in cancelled.")), true);
    const unsubscribe = oauth.onCallback((callback) => {
      if (callback.state === state) finish(() => resolve({ code: callback.code, state }), false);
    });
    const timer = setTimeout(
      () => finish(() => reject(new Error("Sign-in timed out. Try again.")), true),
      SYSTEM_BROWSER_SIGN_IN_TIMEOUT_MS,
    );
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    open(authorizationUrl).catch((error: unknown) => finish(() => reject(error), true));
  });
}
