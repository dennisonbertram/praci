// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));

const update = vi.hoisted(() => vi.fn());
vi.mock("../lib/rpc", () => ({ rpc: { preferences: { update } } }));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/ui-web", async (orig) => ({
  ...(await orig<object>()),
  enqueueNotificationToast: toast,
}));

import {
  getHideAmounts,
  resetHideAmountsMemory,
  setHideAmounts,
} from "../lib/hide-amounts-preference";
import { HideAmountsMenuItem, ShowAmountsButton } from "./HideAmountsToggle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  resetHideAmountsMemory();
});

it("keeps one label and lets the checked state say whether amounts are hidden", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<HideAmountsMenuItem />));
  const row = host.querySelector("[data-testid=hide-amounts-menu-item]") as HTMLElement;
  expect(row.textContent).toContain("Hide amounts");
  expect(row.textContent).toBe("Hide amounts");

  expect(row.getAttribute("aria-checked")).toBe("false");
  expect(row.querySelector("svg.lucide-check")).toBeNull();
  act(() => setHideAmounts(true));
  expect(row.querySelector("svg.lucide-check")).not.toBeNull();
  expect(row.textContent).toBe("Hide amounts");
  expect(row.getAttribute("aria-checked")).toBe("true");
  act(() => root.unmount());
});

it("saves the choice on the user, and keeps it with an error toast if saving fails", async () => {
  update.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("offline"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<HideAmountsMenuItem />));
  const row = host.querySelector("[data-testid=hide-amounts-menu-item]") as HTMLElement;
  await act(async () => row.click());
  expect(update).toHaveBeenLastCalledWith({ hideAmounts: true });
  expect(getHideAmounts()).toBe(true);
  await act(async () => row.click());
  expect(update).toHaveBeenLastCalledWith({ hideAmounts: false });
  // The local choice stays (now shown) and the failure is reported.
  expect(getHideAmounts()).toBe(false);
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Could not save Hide amounts" }),
  );
  act(() => root.unmount());
});

it("offers Show only while amounts are hidden, and one click shows them", async () => {
  update.mockResolvedValue({});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<ShowAmountsButton />));
  expect(host.textContent).toBe("");
  act(() => setHideAmounts(true));
  expect(host.textContent).toBe("Amounts hidden · Show");
  await act(async () => host.querySelector("button")?.click());
  expect(update).toHaveBeenLastCalledWith({ hideAmounts: false });
  expect(getHideAmounts()).toBe(false);
  expect(host.textContent).toBe("");
  act(() => root.unmount());
});
