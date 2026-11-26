// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ connect: vi.fn(), replaceToken: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: api } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BrexCardsConnectDialog } from "./BrexCardsConnectDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onClose = vi.fn();
const onConnected = vi.fn();
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
        <BrexCardsConnectDialog mode={mode} onConnected={onConnected} onClose={onClose} />
        <Where />
      </MemoryRouter>,
    ),
  );
}
const field = () => document.querySelector<HTMLInputElement>('input[aria-label="API token"]')!;
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
  onConnected.mockReset();
  api.connect.mockReset();
  api.replaceToken.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("asks for one password field with the permissions hidden until opened, and Connect waits for a token", async () => {
  await mount();
  const text = document.body.textContent ?? "";
  expect(text).toContain("Connect Brex cards");
  expect(text).toContain("Every change waits for your approval.");
  const details = document.querySelector("details")!;
  expect(details.textContent).toContain("Permissions for the token");
  expect(details.open).toBe(false);
  expect(text).not.toContain("cards.pan");
  await act(async () => {
    details.open = true;
  });
  expect(details.open).toBe(true);
  expect(details.textContent).toContain("Cards");
  expect(details.textContent).toContain("Leave Card Numbers Read and Send off.");
  expect(document.querySelectorAll("input")).toHaveLength(1);
  expect(field().type).toBe("password");
  expect(submit().textContent).toBe("Connect");
  expect(submit().disabled).toBe(true);
  await type("  ");
  expect(submit().disabled).toBe(true);
  await type("tok_demo");
  expect(submit().disabled).toBe(false);
});

it("a refused token shows Brex's message and keeps the dialog; a good one lands on the server page", async () => {
  api.connect.mockRejectedValueOnce(new Error("Brex rejected this token"));
  await mount();
  await type("tok_bad");
  await act(async () => submit().click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Brex rejected this token");
  expect(onClose).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/app/integrations");

  api.connect.mockResolvedValueOnce({ serverId: "srv_1", agentBotId: "bot_1" });
  await act(async () => submit().click());
  expect(api.connect).toHaveBeenLastCalledWith({ token: "tok_bad" });
  expect(onConnected).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/mcp/srv_1",
  );
});

it("replace mode swaps the token, shows the API error, and stays on the page", async () => {
  api.replaceToken.mockRejectedValueOnce(new Error("Could not reach Brex"));
  await mount("replace");
  expect(document.body.textContent).toContain("Replace token");
  await type("tok_new");
  await act(async () => submit().click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Could not reach Brex");
  expect(onClose).not.toHaveBeenCalled();

  api.replaceToken.mockResolvedValueOnce({ ok: true });
  await act(async () => submit().click());
  expect(api.replaceToken).toHaveBeenLastCalledWith({ token: "tok_new" });
  expect(api.connect).not.toHaveBeenCalled();
  expect(onConnected).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/app/integrations");
});
