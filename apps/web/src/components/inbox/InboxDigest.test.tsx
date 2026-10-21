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

import { InboxDigest } from "./InboxDigest";

const row = (id: string, extra: Partial<MailRow> = {}): MailRow => ({
  id,
  connectionId: "c1",
  threadId: `t-${id}`,
  from: "Research Weekly",
  fromAddress: "digest@research.example.test",
  subject: `Issue ${id}`,
  snippet: `Snippet ${id}`,
  receivedAt: "2026-10-18T10:00:00.000Z",
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: "newsletter",
  feedback: null,
  pile: "newsletters",
  ...extra,
});

let root: ReturnType<typeof createRoot>;
type Props = Parameters<typeof InboxDigest>[0];
const show = (extra: Partial<Props> = {}) =>
  act(async () =>
    root.render(<InboxDigest rows={[]} onOpen={() => {}} onArchiveAll={() => {}} {...extra} />),
  );
const button = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("shows one card per issue with the sender, subject, summary and date", async () => {
  await show({
    rows: [row("a", { reason: "Three papers on sleep", unread: true }), row("b")],
  });
  const cards = document.querySelectorAll("[data-row-id]");
  expect(cards).toHaveLength(2);
  const first = cards[0]?.textContent ?? "";
  expect(first).toContain("Research Weekly");
  expect(first).toContain("Issue a");
  expect(first).toContain("Three papers on sleep");
  expect(cards[0]?.querySelector("time")?.getAttribute("datetime")).toBe(
    "2026-10-18T10:00:00.000Z",
  );
  expect(cards[0]?.querySelector("[data-unread-dot]")).not.toBeNull();
  // Without a summary the snippet stands in.
  expect(cards[1]?.textContent).toContain("Snippet b");
  expect(cards[1]?.querySelector("[data-unread-dot]")).toBeNull();
});

it("opens the issue from its Open button", async () => {
  const onOpen = vi.fn();
  await show({ rows: [row("a"), row("b")], onOpen });
  await act(async () => document.querySelector<HTMLElement>('[data-row-id="b"] button')?.click());
  expect(onOpen).toHaveBeenCalledWith("b");
});

it("archives everything shown with Archive all", async () => {
  const onArchiveAll = vi.fn();
  await show({ rows: [row("a")], onArchiveAll });
  await act(async () => button("Archive all 1")?.click());
  expect(onArchiveAll).toHaveBeenCalledTimes(1);
});

it("shows No mail and no Archive all when there is nothing to show", async () => {
  await show();
  expect(document.body.textContent).toContain("No mail");
  expect(button("Archive all 0")).toBeUndefined();
});

it("shows placeholders while loading", async () => {
  await show({ rows: [row("a")], loading: true });
  expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  expect(document.querySelectorAll("[data-row-id]")).toHaveLength(0);
});

it("marks the focused card", async () => {
  await show({ rows: [row("a"), row("b")], selectedId: "b" });
  expect(document.querySelector('[data-row-id="b"]')?.getAttribute("aria-current")).toBe("true");
  expect(document.querySelector('[data-row-id="a"]')?.getAttribute("aria-current")).toBeNull();
});
