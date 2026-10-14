// @vitest-environment jsdom

import type { MailRow } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("../components/SandboxedHtmlViewer", () => ({ SandboxedHtmlViewer: () => null }));

import { InboxRow } from "../components/inbox/InboxRow";

const mail = (extra: Partial<MailRow> = {}): MailRow => ({
  id: "m1",
  connectionId: "c1",
  threadId: "t1",
  from: "Dana Reyes",
  subject: "Offsite dates",
  snippet: "Can you do the 14th?",
  receivedAt: "2026-10-12T13:42:00.000Z",
  unread: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
  ...extra,
});

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function render(
  row: MailRow,
  props: {
    onOpen?: () => void;
    onMark?: (id: string, mark: "important" | "noise" | null) => void;
    selected?: boolean;
    hideAttention?: boolean;
  } = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <InboxRow
        row={row}
        onOpen={props.onOpen ?? (() => {})}
        onMark={props.onMark}
        selected={props.selected}
        hideAttention={props.hideAttention}
        today
      />,
    ),
  );
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
}

const badge = (container: HTMLElement) => container.querySelector('[data-slot="badge"]');

it("shows one label naming why the row needs attention", async () => {
  const container = await render(
    mail({ needsReply: true, priority: "important", category: "reply" }),
  );
  expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
  expect(badge(container)?.textContent).toBe("Needs attention");
});

it.each([
  ["newsletter", "Newsletter"],
  ["spam", "Spam"],
  ["bulk", "Junk"],
  ["scam", "Junk"],
] as const)("labels a %s row %s", async (category, text) => {
  expect(badge(await render(mail({ category })))?.textContent).toBe(text);
});

it("shows no label on an untriaged row", async () => {
  expect(badge(await render(mail()))).toBeNull();
});

it("keeps the warning icon beside the Junk label on a scam row", async () => {
  const container = await render(mail({ category: "scam" }));
  expect(container.querySelector('[role="img"][aria-label="Suspicious"]')).not.toBeNull();
  expect(badge(container)?.textContent).toBe("Junk");
});

it("keeps the time on one line and the subject in the row", async () => {
  const container = await render(mail({ category: "newsletter" }));
  const time = container.querySelector("time");
  expect(time?.className).toContain("whitespace-nowrap");
  expect(time?.className).toContain("tabular-nums");
  expect(container.textContent).toContain("Offsite dates");
  expect(container.textContent).toContain("Can you do the 14th?");
});

it("marks unread with a dot and semibold text, and read with neither", async () => {
  const unread = await render(mail({ unread: true }));
  const read = await render(mail({ unread: false }));
  expect(unread.querySelector("[data-unread-dot]")).not.toBeNull();
  expect(read.querySelector("[data-unread-dot]")).toBeNull();
  const sender = (c: HTMLElement) => c.querySelectorAll('span[dir="auto"]')[0]?.className ?? "";
  expect(sender(unread)).toContain("font-semibold");
  expect(sender(read)).not.toContain("font-semibold");
  expect(read.querySelector("button")?.className).toContain("text-foreground");
  expect(unread.textContent).toContain("(unread)");
  expect(read.textContent).not.toContain("(unread)");
  expect(unread.querySelectorAll("img")).toHaveLength(0);
});

it("hides only the attention label when hideAttention is set", async () => {
  const attention = mail({ needsReply: true, priority: "important", category: "reply" });
  expect(badge(await render(attention, { hideAttention: true }))).toBeNull();
  expect(
    badge(await render(mail({ category: "newsletter" }), { hideAttention: true }))?.textContent,
  ).toBe("Newsletter");
});

it("keeps the date rendered when triage is on", async () => {
  const container = await render(mail(), { onMark: () => {} });
  expect(container.querySelector("time")?.textContent).not.toBe("");
});

it("marks without opening, and a second click clears the mark", async () => {
  const onOpen = vi.fn();
  const onMark = vi.fn();
  const container = await render(mail(), { onOpen, onMark });
  const star = container.querySelector<HTMLButtonElement>('button[aria-label="Mark important"]');
  expect(star?.getAttribute("aria-pressed")).toBe("false");
  await act(async () => star?.click());
  expect(onMark).toHaveBeenCalledWith("m1", "important");
  expect(onOpen).not.toHaveBeenCalled();
  const pressed = await render(mail({ feedback: "important" }), { onOpen, onMark });
  const again = pressed.querySelector<HTMLButtonElement>('button[aria-label="Mark important"]');
  expect(again?.getAttribute("aria-pressed")).toBe("true");
  await act(async () => again?.click());
  expect(onMark).toHaveBeenLastCalledWith("m1", null);
});

it("flags the selected row and exposes its id", async () => {
  const container = await render(mail(), { selected: true });
  const main = container.querySelector("button[data-row-id]");
  expect(main?.getAttribute("data-row-id")).toBe("m1");
  expect(main?.getAttribute("aria-current")).toBe("true");
  expect((await render(mail())).querySelector("button")?.hasAttribute("aria-current")).toBe(false);
});

it("joins the subject and preview with a hyphen, the preview in regular weight", async () => {
  const container = await render(mail());
  const subject = container.querySelectorAll('span[dir="auto"]')[1];
  expect(subject?.textContent).toBe("Offsite dates - Can you do the 14th?");
  expect(subject?.querySelector("span")?.className).toContain("font-normal");
});
