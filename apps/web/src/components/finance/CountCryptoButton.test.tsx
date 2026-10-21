// @vitest-environment jsdom

import type { RunwayCryptoScope } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ setPreferences: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { CountCryptoButton } from "./CountCryptoButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onSaved = vi.fn();
const flush = () => act(async () => {});
async function show(scope: RunwayCryptoScope) {
  await act(async () => root.render(<CountCryptoButton scope={scope} onSaved={onSaved} />));
}
const main = () => container.querySelector('[role="switch"]') as HTMLButtonElement;
const scopeButton = () =>
  container.querySelector("button:not([role=switch])") as HTMLButtonElement | null;
const openMenu = () => act(async () => scopeButton()?.click());
const menuItems = () => [...document.body.querySelectorAll('[role^="menuitem"]')] as HTMLElement[];
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.setPreferences.mockImplementation(async (v: unknown) => v);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("is an off Count crypto switch when not counting, and one click counts all crypto", async () => {
  await show("bank");
  expect(container.textContent).toBe("Count crypto");
  expect(main().getAttribute("aria-checked")).toBe("false");
  expect(scopeButton()).toBeNull();
  await act(async () => main().click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "all" });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it.each([
  ["all", "All crypto"],
  ["stablecoins", "Stablecoins only"],
] as const)("is on and names what counts (%s)", async (scope, label) => {
  await show(scope);
  expect(main().getAttribute("aria-checked")).toBe("true");
  expect(scopeButton()?.textContent).toBe(label);
});

it("offers all crypto and stablecoins only, without wrapping", async () => {
  await show("all");
  await openMenu();
  const items = menuItems();
  expect(items.map((i) => i.textContent)).toEqual(["All crypto", "Stablecoins only"]);
  expect(items[0]?.getAttribute("aria-checked")).toBe("true");
  for (const item of items) expect(item.className).toContain("whitespace-nowrap");
});

it("switches to stablecoins only from the menu", async () => {
  await show("all");
  await openMenu();
  await act(async () => menuItems()[1]?.click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "stablecoins" });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it("turns counting off with the switch", async () => {
  await show("stablecoins");
  await act(async () => main().click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "bank" });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it("shows the server error and does not reload when saving fails", async () => {
  rpcMock.setPreferences.mockRejectedValue(new Error("Could not save"));
  await show("bank");
  await act(async () => main().click());
  await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
  expect(onSaved).not.toHaveBeenCalled();
});

it("disables the switch while a save is pending", async () => {
  let finish: (v: unknown) => void = () => {};
  rpcMock.setPreferences.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
  await show("bank");
  await act(async () => main().click());
  expect(main().hasAttribute("data-disabled")).toBe(true);
  await act(async () => main().click());
  expect(rpcMock.setPreferences).toHaveBeenCalledTimes(1);
  await act(async () => finish({}));
  await flush();
  expect(main().hasAttribute("data-disabled")).toBe(false);
});
