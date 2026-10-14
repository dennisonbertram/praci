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

import { InboxRow } from "./Inbox";

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

async function render(row: MailRow) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(<InboxRow row={row} onOpen={() => {}} onMark={undefined} today />),
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

it("keeps the time on one line, right after the label, and the subject in the row", async () => {
  const container = await render(mail({ category: "newsletter" }));
  const time = container.querySelector("time");
  expect(time?.className).toContain("whitespace-nowrap");
  expect(time?.className).toContain("tabular-nums");
  expect(container.textContent).toContain("Offsite dates");
  expect(container.textContent).toContain("Can you do the 14th?");
  // Label and time share one right-aligned cell so neither can wrap onto the other.
  expect(time?.parentElement).toBe(badge(container)?.parentElement);
});

it("shows the sender's first initial in an avatar chip and loads no image", async () => {
  const container = await render(mail({ from: "dana Reyes" }));
  const chip = container.querySelector("span[aria-hidden='true']");
  expect(chip?.textContent).toBe("D");
  expect(chip?.className).toContain("rounded-full");
  expect(container.querySelectorAll("img")).toHaveLength(0);
});

it("reads unread as semibold and read as regular and muted", async () => {
  const unread = await render(mail({ unread: true }));
  const read = await render(mail({ unread: false }));
  const classes = (c: HTMLElement) => ({
    sender: c.querySelectorAll('span[dir="auto"]')[0]?.className ?? "",
    subject: c.querySelectorAll('span[dir="auto"]')[1]?.className ?? "",
    time: c.querySelector("time")?.className ?? "",
    row: c.querySelector("button")?.className ?? "",
  });
  for (const part of ["sender", "subject", "time"] as const) {
    expect(classes(unread)[part]).toContain("font-semibold");
    expect(classes(read)[part]).not.toContain("font-semibold");
  }
  expect(classes(unread).row).toContain("text-foreground");
  expect(classes(read).row).toContain("text-muted-foreground");
  expect(read.textContent).not.toContain("(unread)");
  expect(unread.textContent).toContain("(unread)");
});

it("joins the subject and preview with a hyphen, the preview in regular weight", async () => {
  const container = await render(mail());
  const subject = container.querySelectorAll('span[dir="auto"]')[1];
  expect(subject?.textContent).toBe("Offsite dates - Can you do the 14th?");
  expect(subject?.querySelector("span")?.className).toContain("font-normal");
});
