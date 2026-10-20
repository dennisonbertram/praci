// @vitest-environment jsdom

import type { MailAction } from "@rakazo/contracts";
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

import { CleanupHistory } from "./CleanupHistory";

const action = (patch: Partial<MailAction> = {}): MailAction => ({
  batchId: "b1",
  kind: "archive",
  source: "user",
  createdAt: "2026-10-18T10:00:00.000Z",
  undone: false,
  threadCount: 31,
  senders: ["news@lists.example.test", "deals@shop.example.test"],
  senderCount: 2,
  ...patch,
});

let root: ReturnType<typeof createRoot>;
const show = (actions: MailAction[], onUndo: (id: string) => void = () => {}) =>
  act(async () => root.render(<CleanupHistory actions={actions} onUndo={onUndo} />));
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("renders nothing without actions", async () => {
  await show([]);
  expect(document.body.textContent).toBe("");
});

it("describes each action with its sender summary and undoes it", async () => {
  const onUndo = vi.fn();
  await show([action()], onUndo);
  expect(document.body.textContent).toContain("Archived 31");
  expect(document.body.textContent).toContain("news@lists.example.test +1");
  await act(async () => document.querySelector<HTMLElement>("li button")?.click());
  expect(onUndo).toHaveBeenCalledWith("b1");
});

it("marks automatic actions and disables Undo once undone", async () => {
  await show([action({ kind: "skip_inbox", source: "auto", undone: true, senderCount: 1 })]);
  expect(document.body.textContent).toContain("Skipped inbox for 31");
  expect(document.body.textContent).toContain("Automatic");
  expect(document.querySelector("li button")?.hasAttribute("disabled")).toBe(true);
});
