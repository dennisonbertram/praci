import { describe, expect, it, vi } from "vitest";
import type { ScannerScopeClaim, ScannerSessionResponse } from "./scanner-session.js";
import { createScannerScopeCoordinator, verifyScannerSessionScope } from "./scanner-session.js";

const origin = "https://server.example.test";
const scope = { userId: "user-one", spaceId: "space-one" };

function response(identity: unknown): ScannerSessionResponse {
  return { ok: true, json: async () => identity };
}

function makeCoordinator(identity: unknown) {
  const window = {};
  let currentIdentity = identity;
  const clearScope = vi.fn(async () => undefined);
  const setScope = vi.fn(async () => undefined);
  const verifyScope = vi.fn(
    (_window: object, serverOrigin: string, claim: ScannerScopeClaim, isCurrent: () => boolean) =>
      verifyScannerSessionScope({
        origin: serverOrigin,
        ...claim,
        fetch: async () => response(currentIdentity),
        isCurrent,
      }),
  );
  const coordinator = createScannerScopeCoordinator({
    currentWindow: () => window,
    originForWindow: () => origin,
    clearScope,
    verifyScope,
    setScope,
  });
  return {
    coordinator,
    window,
    clearScope,
    setScope,
    verifyScope,
    setIdentity: (value: unknown) => {
      currentIdentity = value;
    },
  };
}

describe("scanner session renewal", () => {
  it("restores a saved scope when a renewed session still matches its user and space", async () => {
    const harness = makeCoordinator({ json: scope });
    await expect(harness.coordinator.remember(harness.window, scope)).resolves.toBe("accepted");

    const reauthentication = harness.coordinator.reauthenticate(harness.window);
    expect(harness.coordinator.scope()).toBeNull();
    await expect(reauthentication).resolves.toBe("accepted");

    expect(harness.coordinator.scope()).toEqual({ ...scope, serverOrigin: origin });
    expect(harness.setScope).toHaveBeenCalledTimes(2);
  });

  it("keeps scope cleared when the renewed session belongs to a different identity", async () => {
    const harness = makeCoordinator({ json: scope });
    await expect(harness.coordinator.remember(harness.window, scope)).resolves.toBe("accepted");
    harness.setIdentity({ json: { userId: "user-two", spaceId: scope.spaceId } });

    await expect(harness.coordinator.reauthenticate(harness.window)).resolves.toBe("rejected");

    expect(harness.coordinator.scope()).toBeNull();
    expect(harness.setScope).toHaveBeenCalledOnce();
  });

  it("allows only the latest cookie-triggered verification to restore scope", async () => {
    const window = {};
    let finishFirst!: (authorized: boolean) => void;
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    let verificationCount = 0;
    const setScope = vi.fn(async () => undefined);
    const coordinator = createScannerScopeCoordinator<object>({
      currentWindow: () => window,
      originForWindow: () => origin,
      clearScope: async () => undefined,
      verifyScope: async () => {
        verificationCount++;
        if (verificationCount === 1) {
          firstStarted();
          return new Promise<boolean>((resolve) => {
            finishFirst = resolve;
          });
        }
        return true;
      },
      setScope,
    });

    const first = coordinator.remember(window, scope);
    await started;
    await expect(coordinator.reauthenticate(window)).resolves.toBe("accepted");
    finishFirst(true);

    await expect(first).resolves.toBe("stale");
    expect(coordinator.scope()).toEqual({ ...scope, serverOrigin: origin });
    expect(setScope).toHaveBeenCalledOnce();
  });
});
