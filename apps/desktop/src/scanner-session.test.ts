import { describe, expect, it, vi } from "vitest";
import type { ScannerSessionResponse } from "./scanner-session.js";
import {
  createScannerScopeCoordinator,
  isScannerSessionCookie,
  verifyScannerSessionScope,
} from "./scanner-session.js";

const origin = "https://server.example.test";
const scope = { userId: "user-one", spaceId: "space-one" };

function response(identity: unknown, ok = true): ScannerSessionResponse {
  return { ok, json: async () => identity };
}

describe("scanner session authorization", () => {
  it("checks the requested identity through the trusted session request", async () => {
    const fetch = vi.fn(async (_input: string, _init: RequestInit) =>
      response({ json: { ...scope, name: "Member" } }),
    );
    const isCurrent = vi.fn(() => true);

    await expect(verifyScannerSessionScope({ origin, ...scope, fetch, isCurrent })).resolves.toBe(
      true,
    );

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${origin}/rpc/me`);
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rakazo-space-id": scope.spaceId,
      },
      body: JSON.stringify({ json: null }),
      credentials: "include",
      cache: "no-store",
      redirect: "error",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).not.toHaveProperty("cookie");
    expect(isCurrent).toHaveBeenCalled();
  });

  it("rejects a different user, space, or failed authentication response", async () => {
    for (const identity of [
      { json: { userId: "user-two", spaceId: scope.spaceId } },
      { json: { userId: scope.userId, spaceId: "space-two" } },
    ]) {
      await expect(
        verifyScannerSessionScope({
          origin,
          ...scope,
          fetch: async () => response(identity),
          isCurrent: () => true,
        }),
      ).resolves.toBe(false);
    }

    await expect(
      verifyScannerSessionScope({
        origin,
        ...scope,
        fetch: async () => response({ json: scope }, false),
        isCurrent: () => true,
      }),
    ).resolves.toBe(false);
  });

  it("rejects malformed responses and untrusted origins", async () => {
    const fetch = vi.fn(async () => response({ userId: scope.userId, spaceId: scope.spaceId }));
    await expect(
      verifyScannerSessionScope({ origin, ...scope, fetch, isCurrent: () => true }),
    ).resolves.toBe(false);
    await expect(
      verifyScannerSessionScope({
        origin: "https://user:password@server.example.test",
        ...scope,
        fetch,
        isCurrent: () => true,
      }),
    ).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects a result made stale by a scope clear while the request is pending", async () => {
    let current = true;
    let finishRequest!: (result: ScannerSessionResponse) => void;
    const fetch = vi.fn(
      () =>
        new Promise<ScannerSessionResponse>((resolve) => {
          finishRequest = resolve;
        }),
    );
    const checking = verifyScannerSessionScope({
      origin,
      ...scope,
      fetch,
      isCurrent: () => current,
    });
    current = false;
    finishRequest(response({ json: scope }));

    await expect(checking).resolves.toBe(false);
  });

  it("rejects a result made stale while its body is being read", async () => {
    let current = true;
    let finishBody!: (value: unknown) => void;
    const checking = verifyScannerSessionScope({
      origin,
      ...scope,
      fetch: async () => ({
        ok: true,
        json: () =>
          new Promise<unknown>((resolve) => {
            finishBody = resolve;
          }),
      }),
      isCurrent: () => current,
    });
    await Promise.resolve();
    current = false;
    finishBody({ json: scope });

    await expect(checking).resolves.toBe(false);
  });

  it("identifies only session cookies scoped to the trusted server", () => {
    expect(
      isScannerSessionCookie(
        { domain: "server.example.test", name: "better-auth.session_token" },
        origin,
      ),
    ).toBe(true);
    expect(
      isScannerSessionCookie(
        { domain: ".example.test", name: "__Secure-better-auth.session_token" },
        origin,
      ),
    ).toBe(true);
    expect(
      isScannerSessionCookie(
        { domain: "other.example.test", name: "better-auth.session_token" },
        origin,
      ),
    ).toBe(false);
    expect(
      isScannerSessionCookie({ domain: "server.example.test", name: "analytics" }, origin),
    ).toBe(false);
  });

  it("reauthenticates a saved claim when its window is restored without reloading it", async () => {
    const restoredWindow = { reload: vi.fn() };
    const newWindow = {};
    let currentWindow: object | null = restoredWindow;
    const verifyScope = vi.fn(async () => true);
    const setScope = vi.fn(async () => undefined);
    const coordinator = createScannerScopeCoordinator<object>({
      currentWindow: () => currentWindow,
      originForWindow: (window) =>
        window === restoredWindow ? origin : "https://new-server.example.test",
      clearScope: async () => undefined,
      verifyScope,
      setScope,
    });

    await expect(coordinator.remember(restoredWindow, scope)).resolves.toBe("accepted");
    currentWindow = newWindow;
    await expect(
      coordinator.remember(newWindow, { userId: "user-two", spaceId: "space-two" }),
    ).resolves.toBe("accepted");

    currentWindow = restoredWindow;
    await expect(coordinator.reauthenticate(restoredWindow)).resolves.toBe("accepted");

    expect(coordinator.scope()).toEqual({ ...scope, serverOrigin: origin });
    expect(verifyScope).toHaveBeenLastCalledWith(
      restoredWindow,
      origin,
      scope,
      expect.any(Function),
    );
    expect(restoredWindow.reload).not.toHaveBeenCalled();
  });

  it("does not restore a cleared claim when its earlier verification completes", async () => {
    const window = {};
    let finishVerification!: (authorized: boolean) => void;
    let verificationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      verificationStarted = resolve;
    });
    const verifyScope = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishVerification = resolve;
          verificationStarted();
        }),
    );
    const setScope = vi.fn(async () => undefined);
    const coordinator = createScannerScopeCoordinator<object>({
      currentWindow: () => window,
      originForWindow: () => origin,
      clearScope: async () => undefined,
      verifyScope,
      setScope,
    });

    const pendingVerification = coordinator.remember(window, scope);
    await started;
    await expect(coordinator.remember(window, null)).resolves.toBe("cleared");
    finishVerification(true);

    await expect(pendingVerification).resolves.toBe("stale");
    await expect(coordinator.reauthenticate(window)).resolves.toBe("rejected");
    expect(coordinator.scope()).toBeNull();
    expect(setScope).not.toHaveBeenCalled();
  });
});
