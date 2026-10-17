// @vitest-environment jsdom

import type { MailRow } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t, i18n: { locale: "en" } }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});

import { InboxRow } from "./InboxRow";

const row: MailRow = {
  id: "m1",
  connectionId: "c1",
  threadId: "t1",
  from: "Sam Rivera",
  subject: "Offsite dates",
  snippet: "Can you do the 14th?",
  receivedAt: new Date().toISOString(),
  unread: true,
  inInbox: true,
  needsReply: false,
  priority: null,
  reason: null,
  category: "newsletter",
  feedback: null,
};

let root: ReturnType<typeof createRoot>;
const show = (extra: Partial<Parameters<typeof InboxRow>[0]> = {}) =>
  act(async () =>
    root.render(
      <InboxRow
        row={row}
        onOpen={() => {}}
        onMark={() => {}}
        onArchive={() => {}}
        onRead={() => {}}
        {...extra}
      />,
    ),
  );

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("keeps the triage label in the accessibility tree when the badge is hidden in a narrow pane", async () => {
  await show();
  const badge = [...document.querySelectorAll('[data-slot="badge"]')][0];
  expect(badge?.className).toContain("hidden @md:inline-flex");
  const spoken = document.querySelector("button[data-row-id] .sr-only.\\@md\\:hidden");
  expect(spoken?.textContent).toBe("Newsletter");
});

it("shows a compact label dot in the narrow pane that names the label", async () => {
  await show();
  const dot = document.querySelector("[data-label-dot]");
  expect(dot?.getAttribute("title")).toBe("Newsletter");
  expect(dot?.className).toContain("@md:hidden");
});

it("gives the More trigger a larger touch target on coarse pointers", async () => {
  await show();
  expect(document.querySelector('button[aria-label="More"]')?.className).toContain(
    "pointer-coarse:size-10",
  );
});

it("shows the More menu trigger below md as well as on touch, since the inline actions hide there", async () => {
  await show();
  const inline = document.querySelector('button[aria-label="Archive"]')?.parentElement;
  expect(inline?.className).toContain("@max-md:hidden");
  const more = document.querySelector('button[aria-label="More"]');
  expect(more?.className).toContain("@max-md:inline-flex");
  expect(more?.className).toContain("pointer-coarse:inline-flex");
});

it("is a 56px row", async () => {
  await show();
  expect(document.querySelector("button[data-row-id]")?.className).toContain("h-14");
});

it("names the user's own sent mail You, not their address", async () => {
  await show({ row: { ...row, from: "me@example.test", fromSelf: true } });
  const sender = document.querySelector("button[data-row-id] > span:nth-child(2)");
  expect(sender?.textContent).toBe("You (unread)");
});

it("masks currency in the subject and preview while amounts are hidden", async () => {
  const { setHideAmounts } = await import("../../lib/hide-amounts-preference");
  setHideAmounts(true);
  await show({ row: { ...row, subject: "Invoice $4,812.00", snippet: "Due: $250,000 total" } });
  expect(document.body.textContent).not.toContain("4,812");
  expect(document.body.textContent).not.toContain("250,000");
  await act(async () => setHideAmounts(false));
  expect(document.body.textContent).toContain("$4,812.00");
});

it("says in the More menu that a mark covers all mail from the sender", async () => {
  await show();
  await act(async () => document.querySelector<HTMLElement>('button[aria-label="More"]')?.click());
  const items = [...document.querySelectorAll('[role="menuitemcheckbox"]')].map(
    (el) => el.textContent,
  );
  expect(items).toEqual([
    "Mark importantAll mail from Sam Rivera",
    "Mark noiseAll mail from Sam Rivera",
  ]);
});
