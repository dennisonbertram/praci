// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = (parts: TemplateStringsArray, ...values: unknown[]) =>
  parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), "");
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { CleanupActionBar } from "./CleanupActionBar";

const counts = { archive: 12, unsubscribe: 9, skip_inbox: 11, spam: 12 };
let root: ReturnType<typeof createRoot>;
const show = (extra: Partial<Parameters<typeof CleanupActionBar>[0]> = {}) =>
  act(async () => root.render(<CleanupActionBar counts={counts} onApply={() => {}} {...extra} />));
const button = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === label);
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("shows how many conversations each choice touches and applies the one clicked", async () => {
  const onApply = vi.fn();
  await show({ onApply });
  expect(button("Archive 12")).toBeDefined();
  await act(async () => button("Unsubscribe 9")?.click());
  await act(async () => button("Skip inbox 11")?.click());
  expect(onApply.mock.calls).toEqual([["unsubscribe"], ["skip_inbox"]]);
});

it("disables a choice that touches nothing, and everything while busy", async () => {
  await show({ counts: { ...counts, unsubscribe: 0 } });
  expect(button("Unsubscribe 0")?.hasAttribute("disabled")).toBe(true);
  expect(button("Archive 12")?.hasAttribute("disabled")).toBe(false);
  await show({ busy: true });
  expect(button("Archive 12")?.hasAttribute("disabled")).toBe(true);
});

it("offers Spam in the More menu", async () => {
  const onApply = vi.fn();
  await show({ onApply });
  await act(async () => document.querySelector<HTMLElement>('button[aria-label="More"]')?.click());
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (el) => el.textContent === "Spam 12",
  );
  await act(async () => item?.click());
  expect(onApply).toHaveBeenCalledWith("spam");
});
