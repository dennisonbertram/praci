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

function tab(focused: boolean, over: Record<string, unknown> = {}) {
  return {
    toast: vi.fn(),
    show: vi.fn(),
    requestPermission: vi.fn(async () => "granted" as NotificationPermission),
    state: () => ({ visible: focused, focused }),
    delay: vi.fn(async () => {}),
    reportError: vi.fn(),
    ...over,
  };
}

describe("deliverNotification", () => {
  it("a focused tab toasts at once and calls onShown", async () => {
    const onShown = vi.fn();
    const t = tab(true, { onShown });
    expect(await deliverNotification(n, t)).toBe("toast");
    expect(t.toast).toHaveBeenCalledWith(n);
    expect(onShown).toHaveBeenCalledWith("n1");
    expect(t.delay).not.toHaveBeenCalled();
    expect(t.requestPermission).not.toHaveBeenCalled();
  });

  it("a background tab waits, then shows an OS notification tagged with the id", async () => {
    const t = tab(false, { wasShown: async () => false });
    expect(await deliverNotification(n, t)).toBe("os");
    expect(t.delay).toHaveBeenCalledWith(1500);
    expect(t.show).toHaveBeenCalledWith("Title", { body: "Body", tag: "n1" });
  });

  it("skips when the server says it was already shown", async () => {
    const t = tab(false, { wasShown: async () => true });
    expect(await deliverNotification(n, t)).toBe("skipped");
    expect(t.show).not.toHaveBeenCalled();
  });

  it("toasts when focus is gained during the wait, even if permission is denied", async () => {
    let focused = false;
    const t = tab(false, {
      state: () => ({ visible: focused, focused }),
      delay: async () => {
        focused = true;
      },
      requestPermission: vi.fn(async () => "denied" as NotificationPermission),
    });
    expect(await deliverNotification(n, t)).toBe("toast");
    expect(t.show).not.toHaveBeenCalled();
    expect(t.requestPermission).not.toHaveBeenCalled();
  });

  it("a tab that gains focus during the wait skips if the server says it was already shown", async () => {
    let focused = false;
    const t = tab(false, {
      state: () => ({ visible: focused, focused }),
      delay: async () => {
        focused = true;
      },
      wasShown: async () => true,
    });
    expect(await deliverNotification(n, t)).toBe("skipped");
    expect(t.toast).not.toHaveBeenCalled();
  });

  it("reports an async onShown rejection without failing", async () => {
    const t = tab(true, { onShown: () => Promise.reject(new Error("server")) });
    expect(await deliverNotification(n, t)).toBe("toast");
    expect(t.reportError).toHaveBeenCalledTimes(1);
  });

  it("skips when permission is denied", async () => {
    const t = tab(false, { requestPermission: async () => "denied" });
    expect(await deliverNotification(n, t)).toBe("skipped");
    expect(t.show).not.toHaveBeenCalled();
  });

  it("two background tabs both show with the same tag", async () => {
    const a = tab(false);
    const b = tab(false);
    await Promise.all([deliverNotification(n, a), deliverNotification(n, b)]);
    expect(a.show.mock.calls[0]?.[1]).toMatchObject({ tag: "n1" });
    expect(b.show.mock.calls[0]?.[1]).toMatchObject({ tag: "n1" });
  });

  it("returns failed when show throws", async () => {
    const t = tab(false, {
      show: () => {
        throw new Error("show");
      },
    });
    expect(await deliverNotification(n, t)).toBe("failed");
  });

  it("returns failed when a dependency rejects, never rejecting itself", async () => {
    const t = tab(false, { wasShown: () => Promise.reject(new Error("server")) });
    expect(await deliverNotification(n, t)).toBe("failed");
  });

  it("reports an onShown failure without undoing the toast", async () => {
    const t = tab(true, {
      onShown: () => {
        throw new Error("server");
      },
    });
    expect(await deliverNotification(n, t)).toBe("toast");
    expect(t.reportError).toHaveBeenCalledTimes(1);
  });
});
