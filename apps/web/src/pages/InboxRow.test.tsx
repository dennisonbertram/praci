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
    root.render(<InboxRow row={row} open={false} onToggle={() => {}} onMark={undefined} today />),
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
