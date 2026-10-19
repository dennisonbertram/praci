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

/** Shared by all simulated tabs: one localStorage and one lock manager that queues per name. */
function browser() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  const queues = new Map<string, Promise<unknown>>();
  const locks = {
    request: (name: string, cb: () => Promise<unknown>) => {
      const run = (queues.get(name) ?? Promise.resolve()).then(cb, cb);
      queues.set(
        name,
        run.catch(() => {}),
      );
      return run;
    },
  } as never;
  const toast = vi.fn();
  const show = vi.fn();
  const tab = (focused: boolean, over: Record<string, unknown> = {}) => ({
    toast,
    show,
    requestPermission: async () => "granted" as NotificationPermission,
    storage,
    locks,
    state: () => ({ visible: focused, focused }),
    now: () => 1_000_000,
    delay: async () => {},
    ...over,
  });
  return { tab, toast, show, data };
}

describe("deliverNotification", () => {
  it("a focused tab toasts, calls onShown and never asks for permission", async () => {
    const b = browser();
    const onShown = vi.fn();
    const requestPermission = vi.fn();
    expect(await deliverNotification(n, b.tab(true, { onShown, requestPermission }))).toBe("toast");
    expect(b.toast).toHaveBeenCalledWith(n);
    expect(onShown).toHaveBeenCalledWith("n1");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("an away tab waits, then shows an OS notification tagged with the id", async () => {
    const b = browser();
    const delay = vi.fn(async () => {});
    expect(await deliverNotification(n, b.tab(false, { delay }))).toBe("os");
    expect(delay).toHaveBeenCalledWith(1500);
    expect(b.show).toHaveBeenCalledWith("Title", { body: "Body", tag: "n1" });
  });

  it("skips when permission is not granted", async () => {
    const b = browser();
    expect(
      await deliverNotification(n, b.tab(false, { requestPermission: async () => "denied" })),
    ).toBe("skipped");
    expect(b.show).not.toHaveBeenCalled();
  });

  it("focused plus background tab: one toast, no OS notification", async () => {
    const b = browser();
    // The background tab's delay resolves only after the focused tab has finished.
    const focused = deliverNotification(n, b.tab(true));
    const background = focused.then(() => deliverNotification(n, b.tab(false)));
    expect(await Promise.all([focused, background])).toEqual(["toast", "skipped"]);
    expect(b.toast).toHaveBeenCalledTimes(1);
    expect(b.show).not.toHaveBeenCalled();
  });

  it("two background tabs: exactly one OS notification; a late third tab is skipped", async () => {
    const b = browser();
    const results = await Promise.all([
      deliverNotification(n, b.tab(false)),
      deliverNotification(n, b.tab(false)),
    ]);
    expect(results.sort()).toEqual(["os", "skipped"]);
    expect(await deliverNotification(n, b.tab(false))).toBe("skipped");
    expect(b.show).toHaveBeenCalledTimes(1);
  });

  it("forgets ids after 24 hours", async () => {
    const b = browser();
    await deliverNotification(n, b.tab(false));
    const later = b.tab(false, { now: () => 1_000_000 + 25 * 3600_000 });
    expect(await deliverNotification(n, later)).toBe("os");
  });

  it("returns failed when the lock request rejects", async () => {
    const b = browser();
    const locks = { request: () => Promise.reject(new Error("locks")) };
    expect(await deliverNotification(n, b.tab(false, { locks }))).toBe("failed");
  });

  it("returns failed when show throws, and lets another tab retry", async () => {
    const b = browser();
    const boom = () => {
      throw new Error("show");
    };
    expect(await deliverNotification(n, b.tab(false, { show: boom }))).toBe("failed");
    expect(await deliverNotification(n, b.tab(false))).toBe("os");
  });
});
