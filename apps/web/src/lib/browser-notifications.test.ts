import { describe, expect, it, vi } from "vitest";
import type { BrowserNotificationApi } from "./browser-notifications.js";
import { requestBrowserNotificationPermission } from "./browser-notifications.js";

describe("browser notification permission", () => {
  it("allows a later send gesture to retry a dismissed permission prompt", async () => {
    let resolvePermission: ((permission: "default") => void) | undefined;
    const requestPermission = vi.fn(
      () =>
        new Promise<"default">((resolve) => {
          resolvePermission = resolve;
        }),
    );
    const api: BrowserNotificationApi = { permission: "default", requestPermission };

    requestBrowserNotificationPermission(api);
    requestBrowserNotificationPermission(api);
    expect(requestPermission).toHaveBeenCalledTimes(1);

    resolvePermission?.("default");
    await Promise.resolve();
    requestBrowserNotificationPermission(api);
    expect(requestPermission).toHaveBeenCalledTimes(2);
  });
});
