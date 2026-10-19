import { describe, expect, it, vi } from "vitest";
import { deliverNotification, shouldToast } from "./notification-delivery";

describe("shouldToast", () => {
  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])("visible=%s focused=%s -> %s", (visible, focused, expected) => {
    expect(shouldToast({ visible, focused })).toBe(expected);
  });
});

const n = { id: "n1", title: "Title", body: "Body" };
function deps(over: Record<string, unknown> = {}) {
  return {
    toast: vi.fn(),
    requestPermission: vi.fn(async () => "granted" as NotificationPermission),
    show: vi.fn(),
    state: () => ({ visible: false, focused: false }),
    ...over,
  };
}

describe("deliverNotification", () => {
  it("toasts when present and never asks for permission", async () => {
    const d = deps({ state: () => ({ visible: true, focused: true }) });
    expect(await deliverNotification(n, d)).toBe("toast");
    expect(d.toast).toHaveBeenCalledWith(n);
    expect(d.requestPermission).not.toHaveBeenCalled();
  });

  it("shows an OS notification tagged with the id when away", async () => {
    const d = deps();
    expect(await deliverNotification(n, d)).toBe("os");
    expect(d.show).toHaveBeenCalledWith("Title", { body: "Body", tag: "n1" });
    expect(d.toast).not.toHaveBeenCalled();
  });

  it("skips when permission is not granted", async () => {
    const d = deps({ requestPermission: async () => "denied" });
    expect(await deliverNotification(n, d)).toBe("skipped");
    expect(d.show).not.toHaveBeenCalled();
  });

  it("lets only the tab that gets the lock show it", async () => {
    const held = deps({
      locks: { request: async (_n: string, _o: unknown, cb: (l: null) => void) => cb(null) },
    });
    expect(await deliverNotification(n, held)).toBe("skipped");
    expect(held.show).not.toHaveBeenCalled();
    const free = deps({
      locks: { request: async (_n: string, _o: unknown, cb: (l: object) => void) => cb({}) },
    });
    expect(await deliverNotification(n, free)).toBe("os");
    expect(free.show).toHaveBeenCalledTimes(1);
  });
});
