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

it("shows the More menu trigger below md as well as on touch, since the inline actions hide there", async () => {
  await show();
  const inline = document.querySelector('button[aria-label="Archive"]')?.parentElement;
  expect(inline?.className).toContain("@max-md:hidden");
  const more = document.querySelector('button[aria-label="More"]');
  expect(more?.className).toContain("@max-md:inline-flex");
  expect(more?.className).toContain("pointer-coarse:inline-flex");
});
