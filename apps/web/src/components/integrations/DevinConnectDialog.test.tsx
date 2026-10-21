// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ connect: vi.fn(), replaceKey: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { devin: api } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { DevinConnectDialog } from "./DevinConnectDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onClose = vi.fn();
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
async function mount(mode?: "connect" | "replace") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations"]}>
        <DevinConnectDialog mode={mode} onClose={onClose} />
        <Where />
      </MemoryRouter>,
    ),
  );
}
const field = () =>
  document.querySelector<HTMLInputElement>('input[aria-label="Organization service-user key"]')!;
const submit = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
async function type(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  onClose.mockReset();
  api.connect.mockReset();
  api.replaceKey.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("states what connecting shares and keeps Connect disabled while the field is empty", async () => {
  await mount();
  const text = document.body.textContent ?? "";
  expect(text).toContain("Connect Devin");
  expect(text).toContain("Connects Devin for everyone in this space. Read-only.");
  expect(field().type).toBe("password");
  expect(document.querySelector("a")?.textContent).toBe("Where to find your key");
  expect(submit().disabled).toBe(true);
  await type("  ");
  expect(submit().disabled).toBe(true);
  await type("demo-key");
  expect(submit().disabled).toBe(false);
});

it("a refused key shows The key was refused and keeps the dialog open; a good key closes it and lands on the Devin page", async () => {
  api.connect.mockRejectedValueOnce(new Error("The key was refused."));
  await mount();
  await type("demo-key");
  await act(async () => submit().click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("The key was refused.");
  expect(onClose).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/app/integrations");

  api.connect.mockResolvedValueOnce({ ok: true });
  await act(async () => submit().click());
  expect(api.connect).toHaveBeenLastCalledWith({ secret: "demo-key" });
  expect(onClose).toHaveBeenCalledOnce();
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/app/devin");
});

it("shows the connecting state while the key is checked", async () => {
  let finish: (value: unknown) => void = () => undefined;
  api.connect.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await mount();
  await type("demo-key");
  await act(async () => submit().click());
  expect(submit().disabled).toBe(true);
  expect(submit().textContent).toBe("Connecting…");
  await act(async () => finish({ ok: true }));
});

it("replace mode swaps the key through replaceKey", async () => {
  api.replaceKey.mockResolvedValueOnce({ ok: true });
  await mount("replace");
  await type("new-key");
  await act(async () => submit().click());
  expect(api.replaceKey).toHaveBeenCalledWith({ secret: "new-key" });
  expect(api.connect).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});
