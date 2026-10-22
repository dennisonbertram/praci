import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApprovalToasts from "./approval-toasts";

vi.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw(s, ...v),
}));
const open = vi.hoisted(
  () => new Map<string, { title: string; onClose?: () => void; onSeen?: () => void }>(),
);
vi.mock("@rakazo/ui-web", () => ({
  enqueueNotificationToast: (toast: {
    id: string;
    title: string;
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
      patch: { title: string; data: { onSeen?: () => void }; onClose?: () => void },
    ) => {
      const toast = open.get(id);
      if (toast)
        open.set(id, {
          ...toast,
          title: patch.title,
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

  it("forgets an approval the person dismisses", () => {
    toasts.enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    open.get("n1")?.onClose?.();
    open.delete("n1");
    toasts.enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    expect(titles()).toEqual(["two"]);
  });

  it("opening the group clears only the opened approval; dismissing it clears all", () => {
    for (const [id, chat] of [
      ["n1", "a"],
      ["n2", "b"],
      ["n3", "c"],
    ] as const)
      toasts.enqueueApprovalToast({ id, title: id, href: `/app/${chat}`, onSeen: () => undefined });
    const group = open.get("approvals:group");
    group?.onSeen?.();
    group?.onClose?.();
    expect(titles()).toEqual(["2 need approval"]);
    open.get("approvals:group")?.onClose?.();
    open.delete("approvals:group");
    toasts.enqueueApprovalToast({ id: "n4", title: "four", href: "/app/a" });
    expect(titles()).toEqual(["four"]);
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
});
