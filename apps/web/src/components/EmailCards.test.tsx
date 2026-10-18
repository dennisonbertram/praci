// @vitest-environment jsdom

import type { MessageBlock } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
// The real message view loads the body in a sandboxed iframe; here only its inputs matter.
vi.mock("./inbox/InboxMessageDialog", () => ({
  InboxMessageDialog: ({
    messageId,
    subject,
    onArchive,
    onRead,
    unread,
  }: {
    messageId: string | null;
    subject?: string;
    onArchive?: () => void;
    onRead?: (read: boolean) => void;
    unread?: boolean;
  }) =>
    messageId ? (
      <div role="dialog" data-unread={unread === undefined ? "" : String(unread)}>
        {subject}
        <div data-testid="message-view">{messageId}</div>
        <button type="button" onClick={onArchive}>
          Archive
        </button>
        <button type="button" onClick={() => onRead?.(true)}>
          Mark read
        </button>
      </div>
    ) : null,
}));
const archive = vi.fn(async (_input: unknown) => ({ ok: true }));
const markRead = vi.fn(async (_input: unknown) => ({ ok: true }));
const unarchive = vi.fn(async (_input: unknown) => ({ ok: true }));
vi.mock("../lib/rpc", () => ({
  rpc: {
    inbox: {
      archive: (input: unknown) => archive(input),
      unarchive: (input: unknown) => unarchive(input),
      markRead: (input: unknown) => markRead(input),
    },
  },
}));

import { EmailCards } from "./EmailCards";

type Block = Extract<MessageBlock, { kind: "emails" }>;
const email = (id: string, urgency: Block["emails"][number]["urgency"], extra = {}) => ({
  id,
  urgency,
  from: `Sender ${id}`,
  subject: `Subject ${id}`,
  snippet: `Snippet ${id}`,
  receivedAt: "2026-10-10T09:00:00.000Z",
  ...extra,
});

async function render(block: Block) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<EmailCards block={block} />));
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const headings = (container: HTMLElement) =>
  [...container.querySelectorAll("h3")].map((h) => h.textContent);

it("groups cards by urgency in a fixed order and skips empty groups", async () => {
  const view = await render({
    kind: "emails",
    emails: [
      email("l", "later"),
      email("t", "today"),
      email("w", "this_week"),
      email("s", "within_3_days"),
    ],
  });
  expect(headings(view.container)).toEqual(["Today", "Within 3 days", "This week", "No rush"]);
  await view.cleanup();
  const partial = await render({ kind: "emails", emails: [email("w", "this_week")] });
  expect(headings(partial.container)).toEqual(["This week"]);
  await partial.cleanup();
  // Mail that is all "No rush", such as past updates the bot looked up, needs no heading.
  const later = await render({
    kind: "emails",
    emails: [email("a", "later"), email("b", "later")],
  });
  expect(headings(later.container)).toEqual([]);
  expect(later.container.querySelectorAll('[data-testid="email-row"]')).toHaveLength(2);
  await later.cleanup();
});

it("shows Later as compact rows without the snippet, and urgent mail as cards with it", async () => {
  const view = await render({
    kind: "emails",
    emails: [email("t", "today"), email("l", "later", { attachments: 2 })],
  });
  const card = view.container.querySelector('[data-testid="email-card"]');
  expect(card?.textContent).toContain("Snippet t");
  const row = view.container.querySelector('[data-testid="email-row"]');
  expect(row?.textContent).toContain("Sender l");
  expect(row?.textContent).toContain("Subject l");
  // The same date the Inbox list shows for this mail, not "2d ago".
  expect(row?.textContent).toContain("Oct 10");
  expect(row?.textContent).toContain("2");
  expect(row?.textContent).not.toContain("Snippet l");
  await view.cleanup();
});

it("renders mail text as text, never as markup", async () => {
  const view = await render({
    kind: "emails",
    emails: [
      email("x", "today", {
        subject: '<img src="x" onerror="window.pwned=1">',
        from: "<b>Eve</b>",
      }),
    ],
  });
  expect(view.container.querySelector("img")).toBeNull();
  expect(view.container.querySelector("b")).toBeNull();
  expect(view.container.textContent).toContain('<img src="x" onerror="window.pwned=1">');
  await view.cleanup();
});

it("opens the clicked message by its cached row id", async () => {
  const view = await render({
    kind: "emails",
    emails: [email("one", "today"), email("two", "later")],
  });
  expect(document.querySelector('[data-testid="message-view"]')).toBeNull();
  const second = view.container.querySelector('[data-testid="email-row"]');
  await act(async () => (second as HTMLElement).click());
  expect(document.querySelector('[data-testid="message-view"]')?.textContent).toBe("two");
  expect(document.body.textContent).toContain("Subject two");
  await view.cleanup();
});

it("archives and marks read from the opened card like the Inbox does, and tells the Inbox", async () => {
  const changed = vi.fn();
  window.addEventListener("rakazo:inbox-changed", changed);
  const view = await render({ kind: "emails", emails: [email("one", "today")] });
  const card = view.container.querySelector('[data-testid="email-card"]') as HTMLElement;
  const button = (name: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLElement;
  await act(async () => card.click());
  await act(async () => button("Mark read").click());
  expect(markRead).toHaveBeenCalledWith({ messageId: "one", read: true });
  await act(async () => button("Archive").click());
  expect(archive).toHaveBeenCalledWith({ messageId: "one" });
  // Archive closes the message.
  expect(document.querySelector('[data-testid="message-view"]')).toBeNull();
  expect(changed).toHaveBeenCalledTimes(2);
  window.removeEventListener("rakazo:inbox-changed", changed);
  await view.cleanup();
});

it("puts the unread state back when marking read fails", async () => {
  markRead.mockRejectedValueOnce(new Error("offline"));
  const view = await render({ kind: "emails", emails: [email("one", "today")] });
  await act(async () =>
    (view.container.querySelector('[data-testid="email-card"]') as HTMLElement).click(),
  );
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Mark read",
  );
  await act(async () => (button as HTMLElement).click());
  expect(document.querySelector('[role="dialog"]')?.getAttribute("data-unread")).toBe("");
  expect(view.container.querySelector('[role="alert"]')).not.toBeNull();
  await view.cleanup();
});

it("masks currency on cards and rows while amounts are hidden", async () => {
  const { setHideAmounts } = await import("../lib/hide-amounts-preference");
  setHideAmounts(true);
  const view = await render({
    kind: "emails",
    emails: [
      email("t", "today", { subject: "Charge of $2,400", snippet: "Paid $58,400.00" }),
      email("l", "later", { subject: "Invoice $4,812.00" }),
    ],
  });
  expect(view.container.textContent).not.toMatch(/2,400|58,400|4,812/);
  setHideAmounts(false);
  await view.cleanup();
});

it("says a card's email was archived and offers Undo, as the Inbox list does", async () => {
  const view = await render({ kind: "emails", emails: [email("t", "today")] });
  const click = (el: Element | null | undefined) =>
    act(async () => (el as HTMLElement | null)?.click());
  await click(view.container.querySelector('[data-testid="email-card"]'));
  await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Archive"));
  expect(archive).toHaveBeenCalledWith({ messageId: "t" });
  const card = view.container.querySelector('[data-testid="email-card"]');
  expect(card?.textContent).toContain("Archived");
  const status = view.container.querySelector('[role="status"]');
  expect(status?.textContent).toContain('Archived "Subject t"');
  await click(
    [...(status?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Undo"),
  );
  expect(unarchive).toHaveBeenCalledWith({ messageId: "t" });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  expect(card?.textContent).not.toContain("Archived");
  await view.cleanup();
});

it("starts Undo only after the archive it reverses has finished", async () => {
  unarchive.mockClear();
  let finishArchive: (value: { ok: boolean }) => void = () => {};
  archive.mockReturnValueOnce(new Promise((r) => (finishArchive = r)));
  const view = await render({ kind: "emails", emails: [email("t", "today")] });
  const click = (el: Element | null | undefined) =>
    act(async () => (el as HTMLElement | null)?.click());
  await click(view.container.querySelector('[data-testid="email-card"]'));
  await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Archive"));
  const status = view.container.querySelector('[role="status"]');
  await click(
    [...(status?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Undo"),
  );
  expect(unarchive).not.toHaveBeenCalled();
  await act(async () => finishArchive({ ok: true }));
  expect(unarchive).toHaveBeenCalledWith({ messageId: "t" });
  await view.cleanup();
});
