// @vitest-environment jsdom

import type { MailRow } from "@rakazo/contracts";
import { groupBySender } from "@rakazo/core";
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

import { InboxSenderGroup, senderGroupId } from "./InboxSenderGroup";

const row = (id: string, extra: Partial<MailRow> = {}): MailRow => ({
  id,
  connectionId: "c1",
  threadId: `t-${id}`,
  from: "Acme Billing",
  fromAddress: "billing@acme.example",
  subject: `Subject ${id}`,
  snippet: `Snippet ${id}`,
  receivedAt: new Date(Date.now() - (Number(id.slice(1)) || 1) * 3_600_000).toISOString(),
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
  pile: "updates",
  ...extra,
});

const rows = [
  row("m1", { unread: true, reason: "October invoice, due Nov 30" }),
  row("m2"),
  row("m3", { unread: true }),
];
const [group] = groupBySender(rows);
const one = groupBySender([row("solo")])[0];

let root: ReturnType<typeof createRoot>;
type Props = Parameters<typeof InboxSenderGroup>[0];
const show = (extra: Partial<Props> = {}) =>
  act(async () =>
    root.render(
      <InboxSenderGroup
        group={group as NonNullable<typeof group>}
        expanded={false}
        onToggle={() => {}}
        onOpen={() => {}}
        onMark={undefined}
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

const header = () => document.querySelector<HTMLElement>(`[data-row-id="group:${group?.key}"]`);

it("shows the sender, the message count, the newest subject and its summary on one header", async () => {
  await show();
  const text = header()?.textContent ?? "";
  expect(text).toContain("Acme Billing");
  expect(text).toContain("3");
  expect(text).toContain("Subject m1 — October invoice, due Nov 30");
  expect(header()?.querySelector("[data-unread-dot]")).not.toBeNull();
  expect(header()?.getAttribute("aria-expanded")).toBe("false");
  // The messages stay hidden until the header is opened.
  expect(document.querySelector('[data-row-id="m2"]')).toBeNull();
});

it("expands to list the group's messages, newest first, and reports the toggle", async () => {
  const onToggle = vi.fn();
  await show({ onToggle });
  await act(async () => header()?.click());
  expect(onToggle).toHaveBeenCalledTimes(1);
  await show({ onToggle, expanded: true });
  expect(header()?.getAttribute("aria-expanded")).toBe("true");
  expect(
    [...document.querySelectorAll("[data-row-id]")].map((el) => (el as HTMLElement).dataset.rowId),
  ).toEqual([senderGroupId(group?.key as string), "m1", "m2", "m3"]);
});

it("opens a message from the expanded list", async () => {
  const onOpen = vi.fn();
  await show({ expanded: true, onOpen });
  await act(async () => document.querySelector<HTMLElement>('[data-row-id="m2"]')?.click());
  expect(onOpen).toHaveBeenCalledWith("m2");
});

it("checks every message of the group from the group checkbox", async () => {
  const onPickGroup = vi.fn();
  await show({ onPickGroup, pickedIds: new Set() });
  const box = document.querySelector<HTMLElement>('[role="checkbox"]');
  expect(box?.getAttribute("aria-checked")).toBe("false");
  await act(async () => box?.click());
  expect(onPickGroup).toHaveBeenCalledTimes(1);
});

it("shows the group checkbox checked when all its messages are checked and mixed when some are", async () => {
  await show({ onPickGroup: () => {}, pickedIds: new Set(["m1", "m2", "m3"]) });
  expect(document.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
  await show({ onPickGroup: () => {}, pickedIds: new Set(["m2"]) });
  expect(document.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("mixed");
});

it("archives the group from its Archive button without toggling it", async () => {
  const onArchiveGroup = vi.fn();
  const onToggle = vi.fn();
  await show({ onArchiveGroup, onToggle });
  await act(async () =>
    document.querySelector<HTMLElement>('button[aria-label="Archive"]')?.click(),
  );
  expect(onArchiveGroup).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
});

it("marks the focused header", async () => {
  await show({ selectedId: senderGroupId(group?.key as string) });
  expect(header()?.className).toContain("border-primary");
});

it("shows a sender with one message as an ordinary row", async () => {
  await show({ group: one as NonNullable<typeof one> });
  expect(document.querySelector("[aria-expanded]")).toBeNull();
  expect(document.querySelector('[data-row-id="solo"]')).not.toBeNull();
});
