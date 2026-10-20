// @vitest-environment jsdom

import type { MessageBlock } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));

import { MailThreadCard } from "./MailThreadCard";

const block: Extract<MessageBlock, { kind: "mail_thread" }> = {
  kind: "mail_thread",
  subject: "Q3 vendor invoice",
  messages: [
    { from: "Sample Vendor", to: "me", date: "2026-10-01T09:00:00.000Z", text: "Pay by Friday" },
    {
      from: "Me",
      to: "Sample Vendor",
      date: "2026-10-01T10:00:00.000Z",
      text: "Will do",
      attachments: ["invoice-q3.pdf"],
    },
  ],
};

let root: ReturnType<typeof createRoot>;
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("shows a collapsed count and opens the messages and attachment names on click", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
  act(() => root.render(<MailThreadCard block={block} />));
  const toggle = document.querySelector("button") as HTMLButtonElement;
  expect(toggle.textContent).toContain("Email thread");
  expect(toggle.textContent).toContain("2 messages");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.body.textContent).not.toContain("Pay by Friday");
  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.body.textContent).toContain("Pay by Friday");
  expect(document.body.textContent).toContain("invoice-q3.pdf");
});
