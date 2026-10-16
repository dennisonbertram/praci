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
  cc: "",
  date: "2026-10-10T09:00:00.000Z",
  text: "body",
  html: null,
  attachments: [],
});

let clock = Date.now();
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  clock += 60_000; // each test starts past the j/k throttle the previous one left
  vi.setSystemTime(clock);
  get.mockReset();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
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
  vi.setSystemTime(Date.now() + 200);
  await press("k");
  expect(onNavigate).toHaveBeenLastCalledWith("m1");
});

it("takes one step from a burst of j presses, and another after 150ms", async () => {
  const onNavigate = await open();
  act(() => {
    for (let i = 0; i < 20; i++)
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  });
  expect(onNavigate).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 200);
  await press("j");
  expect(onNavigate).toHaveBeenCalledTimes(2);
});

it("ignores auto-repeated j", async () => {
  const onNavigate = await open();
  await press("j", document.body, { repeat: true });
  expect(onNavigate).not.toHaveBeenCalled();
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

async function show(id: string, extra: Record<string, unknown>) {
  get.mockImplementation(async () => ({ ...message(id), ...extra }));
  act(() => root.render(<InboxMessageDialog messageId={id} onClose={() => {}} />));
  await flush();
}

it("shows the Cc line with the full list as its title, and none without a Cc", async () => {
  await show("cc1", { cc: "Team <team@example.com>, Dev" });
  const cc = document.querySelector('[title="Team <team@example.com>, Dev"]');
  expect(cc?.textContent).toBe("cc Team <team@example.com>, Dev");
  expect(document.querySelector('[title="b@example.com"]')?.textContent).toBe("to b@example.com");
  await show("cc2", {});
  expect(document.body.textContent).not.toContain("cc ");
});

it("breaks a long unbroken URL in a plain-text body", async () => {
  await show("long1", { text: `see https://example.com/${"a".repeat(300)}` });
  expect(document.querySelector("p.wrap-anywhere")?.textContent).toContain("aaaa");
});

it("shows the text, not a blank frame, when the HTML has nothing visible", async () => {
  await show("empty1", {
    html: "<html><head><style>p{}</style></head><body><div> </div></body></html>",
    text: "Plain copy",
  });
  expect(document.body.textContent).toContain("Plain copy");
});

it("archives with the button or e, and marks read or unread, when the page allows it", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onArchive = vi.fn();
  const onRead = vi.fn();
  const render = (unread: boolean) =>
    act(() =>
      root.render(
        <InboxMessageDialog
          messageId="m2"
          nextId="m3"
          onNavigate={() => {}}
          unread={unread}
          onArchive={onArchive}
          onRead={onRead}
          onClose={() => {}}
        />,
      ),
    );
  const button = (name: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === name);
  await render(true);
  await flush();
  await act(async () => button("Archive")?.click());
  await press("e");
  expect(onArchive).toHaveBeenCalledTimes(2);
  await act(async () => button("Mark read")?.click());
  expect(onRead).toHaveBeenLastCalledWith(true);
  await render(false);
  await act(async () => button("Mark unread")?.click());
  expect(onRead).toHaveBeenLastCalledWith(false);
});

it("shows no archive or read buttons and ignores e without them", async () => {
  await open();
  await press("e");
  const names = [...document.querySelectorAll("button")].map((b) => b.textContent);
  expect(names).not.toContain("Archive");
  expect(names).not.toContain("Mark read");
});
