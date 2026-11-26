// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApprovalToasts from "./approval-toasts";

vi.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw(s, ...v),
}));
const open = vi.hoisted(
  () =>
    new Map<
      string,
      { title: string; avatar?: unknown; onClose?: () => void; onSeen?: () => void }
    >(),
);
vi.mock("@rakazo/ui-web", () => ({
  enqueueNotificationToast: (toast: {
    id: string;
    title: string;
    avatar?: unknown;
    onClose?: () => void;
    onSeen?: () => void;
  }) => open.set(toast.id, toast),
  notificationToastManager: {
    close: (id: string) => {
      const toast = open.get(id);
      open.delete(id);
      toast?.onClose?.();
    },
    update: (
      id: string,
      patch: {
        title: string;
        data: { onSeen?: () => void; avatar?: unknown };
        onClose?: () => void;
      },
    ) => {
      const toast = open.get(id);
      if (toast)
        open.set(id, {
          ...toast,
          title: patch.title,
          avatar: patch.data.avatar,
          onSeen: patch.data.onSeen,
          onClose: patch.onClose,
        });
    },
  },
}));

let toasts: typeof ApprovalToasts;

const titles = () => [...open.values()].map((toast) => toast.title);

beforeEach(async () => {
  // A fresh module per test: it remembers dismissed approvals.
  vi.resetModules();
  toasts = await import("./approval-toasts");
  open.clear();
});

describe("approval toasts", () => {
  it("shows one approval as itself", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "Send $300.00?", href: "/app/a" });
    expect(titles()).toEqual(["Send $300.00?"]);
  });

  it("collapses three approvals into one toast", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    toasts.enqueueApprovalToast({ id: "n3", title: "three", href: "/app/c" });
    expect(titles()).toEqual(["3 need approval"]);
  });

  it("goes back to a single toast when all but one are answered, and to none after the last", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    toasts.dismissApprovalToasts("/app/a");
    expect(titles()).toEqual(["two"]);
    toasts.dismissApprovalToasts("/app/b");
    expect(titles()).toEqual([]);
  });

  it("tells the server when X closes a toast, but not when opening it closes the toast", () => {
    const onDismiss = vi.fn();
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" }, { onDismiss });
    open.get("n1")?.onClose?.();
    open.delete("n1");
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const onDismissOpened = vi.fn();
    toasts.enqueueApprovalToast(
      { id: "n2", title: "two", href: "/app/b" },
      { onDismiss: onDismissOpened },
    );
    open.get("n2")?.onSeen?.();
    open.get("n2")?.onClose?.();
    open.delete("n2");
    expect(onDismissOpened).not.toHaveBeenCalled();
    // Leaving the chat unanswered brings it back.
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    expect(titles()).toEqual(["two"]);
  });

  it("forgets an approval the person dismisses", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    open.get("n1")?.onClose?.();
    open.delete("n1");
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    expect(titles()).toEqual(["two"]);
  });

  it("opening the group clears only the opened approval; dismissing it clears all", () => {
    const onDismiss = vi.fn();
    for (const [id, chat] of [
      ["n1", "a"],
      ["n2", "b"],
      ["n3", "c"],
    ] as const)
      toasts.enqueueApprovalToast(
        { id, title: id, href: `/app/${chat}`, onSeen: () => undefined },
        { onDismiss },
      );
    const group = open.get("approvals:group");
    group?.onSeen?.();
    group?.onClose?.();
    expect(titles()).toEqual(["2 need approval"]);
    open.get("approvals:group")?.onClose?.();
    open.delete("approvals:group");
    expect(onDismiss).not.toHaveBeenCalled();
    toasts.enqueueApprovalToast({ id: "n4", title: "four", href: "/app/a" });
    expect(titles()).toEqual(["four"]);
  });

  it("dismissing the group after its opened approval was answered elsewhere closes it", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    toasts.enqueueApprovalToast({ id: "n3", title: "three", href: "/app/c" });
    open.get("approvals:group")?.onSeen?.();
    toasts.retainApprovalToasts(new Set(["n1", "n2"]));
    open.get("approvals:group")?.onClose?.();
    open.delete("approvals:group");
    expect(titles()).toEqual([]);
  });

  it("dismissing the group hides it for the session without dismissing on the server", () => {
    const onDismiss = vi.fn();
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" }, { onDismiss });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" }, { onDismiss });
    open.get("approvals:group")?.onClose?.();
    open.delete("approvals:group");
    expect(titles()).toEqual([]);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(toasts.hasApprovalToasts()).toBe(false);
    // The server still lists them, so the next sync of this session must not bring the group back.
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" }, { onDismiss });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" }, { onDismiss });
    expect(titles()).toEqual([]);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("forgets a hidden approval once it is answered, so a later one with its id shows", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    open.get("approvals:group")?.onClose?.();
    open.delete("approvals:group");
    // The server no longer lists n1 or n2: both were answered.
    toasts.retainApprovalToasts(new Set());
    toasts.enqueueApprovalToast({ id: "n1", title: "one again", href: "/app/a" });
    expect(titles()).toEqual(["one again"]);
  });

  it("adds a sender's avatar to a toast already showing", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    toasts.setApprovalToastAvatar("n1", "avatar");
    expect(open.get("n1")?.avatar).toBe("avatar");
    // A toast that is gone is left alone.
    toasts.setApprovalToastAvatar("n9", "avatar");
    expect(open.has("n9")).toBe(false);
  });

  it("the group shows the newest approval's avatar", () => {
    const older = "older-avatar";
    const newest = "newest-avatar";
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a", avatar: older });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b", avatar: newest });
    expect(open.get("approvals:group")?.avatar).toBe(newest);
  });

  it("clears the approvals of a group chat by its link", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/g/g1" });
    toasts.dismissApprovalToasts("/app/g/g1");
    expect(titles()).toEqual([]);
  });

  it("clears an approval by the bot that holds the card when its link points at another chat", () => {
    toasts.enqueueApprovalToast(
      { id: "n1", title: "Send $300.00?", href: "/app/chief" },
      { botId: "mercury" },
    );
    toasts.dismissApprovalToasts({ href: "/app/mercury", botId: "mercury" });
    expect(titles()).toEqual([]);
  });

  it("raises no toast for a chat that is open, such as one email's agent panel", () => {
    const release = toasts.markApprovalChatOpen("email-1");
    toasts.enqueueApprovalToast(
      { id: "n1", title: "Reply?", href: "/app/email-1" },
      { botId: "email-1" },
    );
    expect(titles()).toEqual([]);
    release();
    toasts.enqueueApprovalToast(
      { id: "n2", title: "Reply?", href: "/app/email-1" },
      { botId: "email-1" },
    );
    expect(titles()).toEqual(["Reply?"]);
    toasts.dismissApprovalToasts({ botId: "email-1" });
  });

  it("asks for a rebuild when the chat closes, so an unanswered approval comes back", () => {
    const rebuild = vi.fn();
    window.addEventListener("rakazo:notifications-changed", rebuild);
    toasts.markApprovalChatOpen("email-2")();
    window.removeEventListener("rakazo:notifications-changed", rebuild);
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it("drops an approval the server no longer lists, and does not bring back a dismissed one", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    toasts.retainApprovalToasts(new Set(["n2"]));
    expect(titles()).toEqual(["two"]);
    open.get("n2")?.onClose?.();
    open.delete("n2");
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    expect(titles()).toEqual([]);
  });

  it("closes every approval toast when the session ends", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    expect(titles()).toEqual(["one"]);
    toasts.clearApprovalToasts();
    expect(titles()).toEqual([]);
    expect(toasts.hasApprovalToasts()).toBe(false);
  });
});
