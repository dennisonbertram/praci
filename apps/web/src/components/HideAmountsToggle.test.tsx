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

import { resetHideAmountsMemory, setHideAmounts } from "../lib/hide-amounts-preference";
import { HideAmountsMenuItem } from "./HideAmountsToggle";

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
  act(() => setHideAmounts(true));
  expect(row.textContent).toBe("Hide amounts");
  expect(row.getAttribute("aria-checked")).toBe("true");
  act(() => root.unmount());
});
