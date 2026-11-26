const SCANNER_SESSION_TIMEOUT_MS = 5_000;

export interface ScannerSessionResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export interface ScannerSessionVerification {
  origin: string;
  userId: string;
  spaceId: string;
  fetch: (input: string, init: RequestInit) => Promise<ScannerSessionResponse>;
  isCurrent: () => boolean;
}

export interface ScannerScopeClaim {
  userId: string;
  spaceId: string;
}

export interface VerifiedScannerScope extends ScannerScopeClaim {
  serverOrigin: string;
}

export type ScannerScopeReauthenticationResult = "accepted" | "rejected" | "stale" | "cleared";

export interface ScannerScopeCoordinatorOptions<TWindow extends object> {
  currentWindow: () => TWindow | null;
  originForWindow: (window: TWindow) => string | null;
  clearScope: () => Promise<void>;
  verifyScope: (
    window: TWindow,
    origin: string,
    claim: ScannerScopeClaim,
    isCurrent: () => boolean,
  ) => Promise<boolean>;
  setScope: (claim: ScannerScopeClaim, origin: string) => Promise<void>;
}

function isTrustedOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.origin === origin
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function verifyScannerSessionScope(
  verification: ScannerSessionVerification,
): Promise<boolean> {
  if (!isTrustedOrigin(verification.origin) || !verification.isCurrent()) return false;
  try {
    const response = await verification.fetch(`${verification.origin}/rpc/me`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rakazo-space-id": verification.spaceId,
      },
      body: JSON.stringify({ json: null }),
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(SCANNER_SESSION_TIMEOUT_MS),
    });
    if (!response.ok || !verification.isCurrent()) return false;
    const payload = await response.json();
    if (!verification.isCurrent() || !isRecord(payload) || !isRecord(payload.json)) return false;
    return (
      payload.json.userId === verification.userId &&
      payload.json.spaceId === verification.spaceId &&
      verification.isCurrent()
    );
  } catch {
    return false;
  }
}

export function createScannerScopeCoordinator<TWindow extends object>(
  options: ScannerScopeCoordinatorOptions<TWindow>,
) {
  const claims = new WeakMap<TWindow, ScannerScopeClaim>();
  let generation = 0;
  let verifiedScope: VerifiedScannerScope | null = null;

  function sameScope(left: VerifiedScannerScope | null, right: VerifiedScannerScope) {
    return (
      left !== null &&
      left.userId === right.userId &&
      left.spaceId === right.spaceId &&
      left.serverOrigin === right.serverOrigin
    );
  }

  function invalidate() {
    generation++;
    verifiedScope = null;
    return options.clearScope();
  }

  function isCurrent(attempt: number, window: TWindow, origin: string, claim: ScannerScopeClaim) {
    return (
      generation === attempt &&
      options.currentWindow() === window &&
      options.originForWindow(window) === origin &&
      claims.get(window) === claim
    );
  }

  async function authenticate(window: TWindow, claim: ScannerScopeClaim | undefined) {
    const attempt = generation + 1;
    const clearing = invalidate();
    await clearing;
    if (generation !== attempt) return "stale" as const;
    if (claim === undefined) return "rejected" as const;

    const origin = options.originForWindow(window);
    if (origin === null || options.currentWindow() !== window) return "stale" as const;
    const stillCurrent = () => isCurrent(attempt, window, origin, claim);
    if (!stillCurrent()) return "stale" as const;

    let authorized = false;
    try {
      authorized = await options.verifyScope(window, origin, claim, stillCurrent);
    } catch {
      authorized = false;
    }
    if (!stillCurrent()) return "stale" as const;
    if (!authorized) return "rejected" as const;

    const nextScope = { ...claim, serverOrigin: origin };
    verifiedScope = nextScope;
    try {
      await options.setScope(claim, origin);
    } catch {
      if (stillCurrent() && sameScope(verifiedScope, nextScope)) {
        await invalidate().catch(() => undefined);
      }
      return "rejected" as const;
    }

    if (stillCurrent() && sameScope(verifiedScope, nextScope)) return "accepted" as const;
    if (generation === attempt && sameScope(verifiedScope, nextScope)) {
      await invalidate().catch(() => undefined);
    }
    return "stale" as const;
  }

  return {
    generation: () => generation,
    scope: () => (verifiedScope === null ? null : { ...verifiedScope }),
    matches: (scope: VerifiedScannerScope) => sameScope(verifiedScope, scope),
    isCurrent: (attempt: number, window: TWindow, origin: string) =>
      generation === attempt &&
      options.currentWindow() === window &&
      options.originForWindow(window) === origin,
    invalidate,
    remember(window: TWindow, claim: ScannerScopeClaim | null) {
      if (claim === null) {
        claims.delete(window);
        return invalidate().then(() => "cleared" as const);
      }
      const savedClaim = { ...claim };
      claims.set(window, savedClaim);
      return authenticate(window, savedClaim);
    },
    reauthenticate(window: TWindow) {
      return authenticate(window, claims.get(window));
    },
    forgetWindow(window: TWindow) {
      claims.delete(window);
      return options.currentWindow() === window ? invalidate() : Promise.resolve();
    },
  };
}

export function isScannerSessionCookie(cookie: { domain?: string; name: string }, origin: string) {
  try {
    if (cookie.domain === undefined) return false;
    const hostname = new URL(origin).hostname.toLowerCase();
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    const matchesOrigin = hostname === domain || hostname.endsWith(`.${domain}`);
    return matchesOrigin && /(?:^|[._-])session(?:_token|_data)?$/i.test(cookie.name);
  } catch {
    return false;
  }
}
