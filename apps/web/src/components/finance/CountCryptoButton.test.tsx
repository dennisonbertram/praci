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
const main = () => container.querySelector("button[aria-pressed]") as HTMLButtonElement;
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

it("reads Count crypto when off, and turns crypto on with all", async () => {
  await show("bank");
  expect(main().textContent).toBe("Count crypto");
  expect(main().getAttribute("aria-pressed")).toBe("false");
  expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  await act(async () => main().click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "all" });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it.each(["all", "stablecoins"] as const)(
  "reads Counting crypto when on (%s), Not counting crypto on focus, and turns off",
  async (scope) => {
    await show(scope);
    expect(main().textContent).toBe("Counting crypto");
    expect(main().getAttribute("aria-pressed")).toBe("true");
    await act(async () => main().focus());
    expect(main().textContent).toBe("Not counting crypto");
    await act(async () => main().click());
    await flush();
    expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "bank" });
    expect(onSaved).toHaveBeenCalledTimes(1);
  },
);

it("switches between all crypto and stablecoins only from the menu", async () => {
  await show("all");
  await act(async () => (container.querySelector('[aria-haspopup="menu"]') as HTMLElement).click());
  const items = [...document.body.querySelectorAll('[role="menuitemradio"]')];
  expect(items.map((i) => i.textContent)).toEqual(["All crypto", "Stablecoins only"]);
  expect(items[0]?.getAttribute("aria-checked")).toBe("true");
  await act(async () => (items[1] as HTMLElement).click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "stablecoins" });
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

it("keeps Counting crypto right after turning on, until focus leaves and returns", async () => {
  await show("bank");
  await act(async () => main().focus());
  await act(async () => main().click());
  await flush();
  await show("all");
  expect(main().textContent).toBe("Counting crypto");
  await act(async () => main().blur());
  await act(async () => main().focus());
  expect(main().textContent).toBe("Not counting crypto");
});
