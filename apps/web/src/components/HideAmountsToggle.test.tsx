// @vitest-environment jsdom
import { i18n } from "@lingui/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { HideAmountsMenuItem } from "./HideAmountsToggle";

i18n.loadAndActivate({ locale: "en", messages: {} });

afterEach(() => {
  setHideAmounts(false);
  document.body.innerHTML = "";
});

it("describes what the account-menu row will do in each state", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<HideAmountsMenuItem />));
  const row = () => document.querySelector("[data-testid='hide-amounts-menu-item']");
  expect(row()?.textContent).toMatch(/^Hide amountsHides money/);
  await act(async () => (row() as HTMLButtonElement).click());
  expect(row()?.textContent).toMatch(/^Show amountsMoney is hidden/);
  await act(async () => root.unmount());
});
