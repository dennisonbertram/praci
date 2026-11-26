// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t, i18n: { locale: "en" } }) };
});

import { InboxAccountTabs } from "./InboxAccountTabs";

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '<div id="r"></div>';
  root = createRoot(document.getElementById("r")!);
});
afterEach(() => act(async () => root.unmount()));
const a = (connectionId: string, label: string, address?: string) => ({
  connectionId,
  label,
  address,
});
const show = (accounts: ReturnType<typeof a>[], onChange = () => {}) =>
  act(async () =>
    root.render(<InboxAccountTabs accounts={accounts} value={undefined} onChange={onChange} />),
  );
const names = () => [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent);

it("renders nothing for one account", async () => {
  await show([a("c1", "Work")]);
  expect(names()).toEqual([]);
});

it("shows All first, then each label", async () => {
  await show([a("c1", "Work", "w@x.com"), a("c2", "Studio", "s@x.com")]);
  expect(names()).toEqual(["All", "Work", "Studio"]);
});

it("falls back to the address when labels collide", async () => {
  await show([a("c1", "Gmail", "w@x.com"), a("c2", "gmail", "s@x.com")]);
  expect(names()).toEqual(["All", "w@x.com", "s@x.com"]);
});

it("reports the chosen connection, and undefined for All", async () => {
  const onChange = vi.fn();
  await show([a("c1", "Work"), a("c2", "Studio")], onChange);
  const tab = (n: string) =>
    [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent === n);
  await act(async () => {
    tab("Studio")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onChange).toHaveBeenLastCalledWith("c2");
});
