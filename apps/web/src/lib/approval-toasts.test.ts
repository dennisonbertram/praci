import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { dismissApprovalToasts, enqueueApprovalToast } from "./approval-toasts";

const titles = () => [...open.values()].map((toast) => toast.title);

beforeEach(() => {
  // Answer everything left over so each test starts empty.
  for (const chat of ["/app/a", "/app/b", "/app/c"]) dismissApprovalToasts(chat);
  open.clear();
});

describe("approval toasts", () => {
  it("shows one approval as itself", () => {
    enqueueApprovalToast({ id: "n1", title: "Send $300.00?", href: "/app/a" });
    expect(titles()).toEqual(["Send $300.00?"]);
  });

  it("collapses three approvals into one toast", () => {
    enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    enqueueApprovalToast({ id: "n3", title: "three", href: "/app/c" });
    expect(titles()).toEqual(["3 need approval"]);
  });

  it("goes back to a single toast when all but one are answered, and to none after the last", () => {
    enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    dismissApprovalToasts("/app/a");
    expect(titles()).toEqual(["two"]);
    dismissApprovalToasts("/app/b");
    expect(titles()).toEqual([]);
  });

  it("forgets an approval the person dismisses", () => {
    enqueueApprovalToast({ id: "n1", title: "one", href: "/app/a" });
    open.get("n1")?.onClose?.();
    open.delete("n1");
    enqueueApprovalToast({ id: "n2", title: "two", href: "/app/b" });
    expect(titles()).toEqual(["two"]);
  });

  it("opening the group clears only the opened approval; dismissing it clears all", () => {
    for (const [id, chat] of [
      ["n1", "a"],
      ["n2", "b"],
      ["n3", "c"],
    ] as const)
      enqueueApprovalToast({ id, title: id, href: `/app/${chat}`, onSeen: () => undefined });
    const group = open.get("approvals:group");
    group?.onSeen?.();
    group?.onClose?.();
    expect(titles()).toEqual(["2 need approval"]);
    open.get("approvals:group")?.onClose?.();
    open.delete("approvals:group");
    enqueueApprovalToast({ id: "n4", title: "four", href: "/app/a" });
    expect(titles()).toEqual(["four"]);
  });

  it("clears the approvals of a group chat by its link", () => {
    enqueueApprovalToast({ id: "n1", title: "one", href: "/app/g/g1" });
    dismissApprovalToasts("/app/g/g1");
    expect(titles()).toEqual([]);
  });
});
