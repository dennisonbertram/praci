import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw(s, ...v),
}));
const open = vi.hoisted(() => new Map<string, { title: string; onClose?: () => void }>());
vi.mock("@rakazo/ui-web", () => ({
  enqueueNotificationToast: (toast: { id: string; title: string; onClose?: () => void }) =>
    open.set(toast.id, toast),
  notificationToastManager: {
    close: (id: string) => {
      const toast = open.get(id);
      open.delete(id);
      toast?.onClose?.();
    },
    update: (id: string, patch: { title: string }) => {
      const toast = open.get(id);
      if (toast) open.set(id, { ...toast, title: patch.title });
    },
  },
}));

import { dismissApprovalToastsForBot, enqueueApprovalToast } from "./approval-toasts";

const titles = () => [...open.values()].map((toast) => toast.title);

beforeEach(() => {
  // Answer everything left over so each test starts empty.
  for (const botId of ["a", "b", "c"]) dismissApprovalToastsForBot(botId);
  open.clear();
});

describe("approval toasts", () => {
  it("shows one approval as itself", () => {
    enqueueApprovalToast({ id: "n1", title: "Send $300.00?" }, "a");
    expect(titles()).toEqual(["Send $300.00?"]);
  });

  it("collapses three approvals into one toast", () => {
    enqueueApprovalToast({ id: "n1", title: "one" }, "a");
    enqueueApprovalToast({ id: "n2", title: "two" }, "b");
    enqueueApprovalToast({ id: "n3", title: "three" }, "c");
    expect(titles()).toEqual(["3 need approval"]);
  });

  it("goes back to a single toast when all but one are answered, and to none after the last", () => {
    enqueueApprovalToast({ id: "n1", title: "one" }, "a");
    enqueueApprovalToast({ id: "n2", title: "two" }, "b");
    dismissApprovalToastsForBot("a");
    expect(titles()).toEqual(["two"]);
    dismissApprovalToastsForBot("b");
    expect(titles()).toEqual([]);
  });

  it("forgets an approval the person dismisses", () => {
    enqueueApprovalToast({ id: "n1", title: "one" }, "a");
    open.get("n1")?.onClose?.();
    open.delete("n1");
    enqueueApprovalToast({ id: "n2", title: "two" }, "b");
    expect(titles()).toEqual(["two"]);
  });
});
