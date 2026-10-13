// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), ""),
}));
vi.mock("../../components/SandboxedHtmlViewer", () => ({ SandboxedHtmlViewer: () => null }));
vi.mock("../../components/ComposeEmail", () => ({
  ComposeEmail: ({ seed }: { seed: { kind: string } }) => (
    <div data-testid="compose">{seed.kind}</div>
  ),
}));
const get = vi.fn();
vi.mock("../../lib/rpc", () => ({
  rpc: { inbox: { get: (input: unknown) => get(input) } },
  withSpaceHeaders: () => new Headers(),
}));

import { InboxMessageDialog } from "./InboxMessageDialog";

const message = (id: string) => ({
  id,
  subject: `Subject ${id}`,
  from: "a@example.com",
  to: "b@example.com",
  date: "2026-10-10T09:00:00.000Z",
  text: "body",
  html: null,
  attachments: [],
});

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  get.mockReset();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
const press = (key: string, target: Element = document.body) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

async function open(onNavigate = vi.fn()) {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="m2"
        previousId="m1"
        nextId="m3"
        onNavigate={onNavigate}
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  return onNavigate;
}

it("j and k navigate to next and previous", async () => {
  const onNavigate = await open();
  await press("j");
  expect(onNavigate).toHaveBeenLastCalledWith("m3");
  await press("k");
  expect(onNavigate).toHaveBeenLastCalledWith("m1");
});

it("ignores keys typed in inputs", async () => {
  const onNavigate = await open();
  const input = document.createElement("input");
  document.body.appendChild(input);
  await press("j", input);
  expect(onNavigate).not.toHaveBeenCalled();
});

it("r opens a reply", async () => {
  await open();
  await press("r");
  expect(document.querySelector('[data-testid="compose"]')?.textContent).toBe("reply");
});

it("Try again refetches after a failure", async () => {
  get.mockRejectedValueOnce(new Error("offline"));
  act(() => root.render(<InboxMessageDialog messageId="m9" onClose={() => {}} />));
  await flush();
  get.mockResolvedValueOnce(message("m9"));
  const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Try again");
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  await flush();
  expect(document.body.textContent).toContain("Subject m9");
});

it("opens with focus on the dialog, not on the previous-message button", async () => {
  await open();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const popup = document.querySelector('[data-slot="dialog-content"]');
  expect(document.activeElement).toBe(popup);
  expect(document.activeElement?.getAttribute("aria-label")).not.toBe("Previous message");
});
