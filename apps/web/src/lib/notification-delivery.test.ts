import { beforeEach, describe, expect, it, vi } from "vitest";
import * as approvalToasts from "./approval-toasts";

vi.mock("./approval-toasts", () => ({
  enqueueApprovalToast: vi.fn(),
  hasApprovalToast: vi.fn(() => false),
  retainApprovalToasts: vi.fn(),
}));
const toasts = vi.mocked(approvalToasts);

import {
  attentionFromDto,
  deliverNotification,
  openNotificationLink,
  resultShownInOpenChat,
  shouldToast,
  syncApprovalToasts,
} from "./notification-delivery";

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

describe("resultShownInOpenChat", () => {
  it("skips a failure in the open chat, and a finished run while the tab is in front", () => {
    expect(resultShownInOpenChat({ botId: "b1", kind: "failed" }, "b1", false)).toBe(true);
    // A background agent's failure shows as a badge on its sidebar row, not a toast, while the tab is in front.
    expect(resultShownInOpenChat({ botId: "b2", kind: "failed" }, "b1", true)).toBe(true);
    expect(resultShownInOpenChat({ botId: "b2", kind: "failed" }, "b1", false)).toBe(false);
    // The open chat already shows its own approval card.
    expect(resultShownInOpenChat({ botId: "b1", kind: "needs_input" }, "b1", true)).toBe(true);
    expect(resultShownInOpenChat({ botId: "b2", kind: "needs_input" }, "b1", true)).toBe(false);
    expect(resultShownInOpenChat({ botId: "b1", kind: "done" }, "b1", true)).toBe(true);
    expect(resultShownInOpenChat({ botId: "b1", kind: "done" }, "b1", false)).toBe(false);
    // An agent that is not on screen gets its sidebar row only.
    expect(resultShownInOpenChat({ botId: "b1", kind: "done" }, "b2", true)).toBe(true);
    expect(resultShownInOpenChat({ botId: "b1", kind: "done" }, undefined, true)).toBe(true);
    expect(resultShownInOpenChat({ botId: "b1", kind: "done" }, undefined, false)).toBe(false);
    expect(resultShownInOpenChat({ botId: "b1", kind: "failed" }, undefined, true)).toBe(true);
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
    expect(t.show).toHaveBeenCalledWith("Title", { body: "Body", tag: "n1" }, expect.any(Function));
  });

  it("skips the OS notification when the Browser switch is off, but still toasts", async () => {
    const off = tab(false, { browserEnabled: () => false });
    expect(await deliverNotification(n, off)).toBe("skipped");
    expect(off.show).not.toHaveBeenCalled();
    expect(off.requestPermission).not.toHaveBeenCalled();
    const focused = tab(true, { browserEnabled: () => false });
    expect(await deliverNotification(n, focused)).toBe("toast");
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

const DEVIN_URL = "https://app.devin.ai/sessions/devin-0001";

describe("opening a notification link", () => {
  it("opens a Devin session in a new window without opener or referrer, and navigates in-app links", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    const navigate = vi.fn();
    openNotificationLink(navigate)(DEVIN_URL);
    expect(open).toHaveBeenCalledWith(DEVIN_URL, "_blank", "noopener,noreferrer");
    expect(navigate).not.toHaveBeenCalled();
    openNotificationLink(navigate)("/app/bot-1");
    expect(navigate).toHaveBeenCalledWith("/app/bot-1");
    expect(open).toHaveBeenCalledTimes(1);
    // Any other absolute URL is not opened either.
    openNotificationLink(navigate)("https://evil.example/sessions/x");
    expect(open).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("an OS banner click focuses the window, then opens the link", async () => {
    const focus = vi.fn();
    const open = vi.fn();
    const t = tab(false, { wasShown: async () => false, focus, open });
    await deliverNotification({ ...n, href: DEVIN_URL }, t);
    expect(t.show).toHaveBeenCalledWith("Title", { body: "Body", tag: "n1" }, expect.any(Function));
    t.show.mock.calls[0]?.[2]();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(DEVIN_URL);
  });

  it("a banner without a link only focuses the window", async () => {
    const focus = vi.fn();
    const open = vi.fn();
    const t = tab(false, { wasShown: async () => false, focus, open });
    await deliverNotification(n, t);
    t.show.mock.calls[0]?.[2]();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });
});

describe("attentionFromDto", () => {
  const base = {
    id: "n1",
    botId: "b1",
    surface: "chat",
    threadId: null,
    title: "Inbox agent needs approval",
    body: null,
    link: "/app/b1",
    importance: "attention" as const,
    createdAt: "2030-01-01T00:00:00.000Z",
    seenAt: null,
    shownAt: null,
  };
  it("keeps an approval toast until it is opened or dismissed", () => {
    expect(attentionFromDto({ ...base, kind: "needs_input" }).timeout).toBe(0);
    expect(attentionFromDto({ ...base, kind: "done" }).timeout).toBeUndefined();
  });
  it("groups only approvals; questions and codes stay their own toasts", () => {
    const needs = { ...base, kind: "needs_input" as const };
    expect(attentionFromDto(needs).approval).toBe(true);
    expect(attentionFromDto({ ...needs, title: "Inbox agent needs an answer" }).approval).toBe(
      false,
    );
    expect(attentionFromDto({ ...needs, title: "Inbox agent needs a code" }).approval).toBe(false);
    expect(attentionFromDto({ ...base, kind: "done" }).approval).toBeUndefined();
  });
});

describe("syncApprovalToasts", () => {
  const approval = {
    id: "n9",
    botId: "mercury",
    surface: "thread",
    threadId: "t1",
    title: "Mercury agent needs approval",
    body: null,
    link: "/app/mercury",
    importance: "attention" as const,
    kind: "needs_input" as const,
    createdAt: "2030-01-01T00:00:00.000Z",
    seenAt: null,
    shownAt: "2030-01-01T00:00:01.000Z",
  };
  const options = { complete: true, onSeen: () => () => undefined };
  beforeEach(() => {
    toasts.enqueueApprovalToast.mockClear();
    toasts.retainApprovalToasts.mockClear();
    toasts.hasApprovalToast.mockReturnValue(false);
  });
  it("shows an unanswered approval again after a reload, keyed by the bot that holds the card", () => {
    syncApprovalToasts([approval], options);
    expect(toasts.enqueueApprovalToast).toHaveBeenCalledTimes(1);
    expect(toasts.enqueueApprovalToast.mock.calls[0]?.[1]).toEqual({ botId: "mercury" });
    // A payment Chief asked for is held by the Mercury agent: the toast opens that chat.
    expect(toasts.enqueueApprovalToast.mock.calls[0]?.[0]).toMatchObject({ href: "/app/mercury" });
    expect(toasts.retainApprovalToasts).toHaveBeenCalledWith(new Set(["n9"]));
  });
  it("shows nothing for a seen approval and drops toasts the server no longer lists", () => {
    syncApprovalToasts([{ ...approval, seenAt: "2030-01-01T00:01:00.000Z" }], options);
    expect(toasts.enqueueApprovalToast).not.toHaveBeenCalled();
    expect(toasts.retainApprovalToasts).toHaveBeenCalledWith(new Set());
  });
  it("leaves toasts alone when the list was cut short or the toast already shows", () => {
    toasts.hasApprovalToast.mockReturnValue(true);
    syncApprovalToasts([approval], { ...options, complete: false });
    expect(toasts.enqueueApprovalToast).not.toHaveBeenCalled();
    expect(toasts.retainApprovalToasts).not.toHaveBeenCalled();
  });
});
