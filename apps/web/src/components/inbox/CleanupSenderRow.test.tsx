// @vitest-environment jsdom

import type { CleanupSender } from "@rakazo/contracts";
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

import { CleanupSenderRow } from "./CleanupSenderRow";

const sender: CleanupSender = {
  connectionId: "c1",
  address: "news@lists.example.test",
  name: "Northwind Weekly",
  messageCount: 20,
  readCount: 1,
  lastReceivedAt: "2026-10-18T10:00:00.000Z",
  inboxThreads: 12,
  preselected: true,
  spamLike: false,
  unsubscribe: "link",
  skipInbox: false,
  unsubscribeStatus: null,
};

let root: ReturnType<typeof createRoot>;
const show = (extra: Partial<Parameters<typeof CleanupSenderRow>[0]> = {}) =>
  act(async () =>
    root.render(
      <CleanupSenderRow sender={sender} checked={false} onToggle={() => {}} {...extra} />,
    ),
  );
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("shows the name, address, message count, read rate and last date", async () => {
  await show();
  const content = document.body.textContent ?? "";
  expect(content).toContain("Northwind Weekly");
  expect(content).toContain("news@lists.example.test");
  expect(content).toContain("20");
  expect(content).toContain("5% read");
  expect(document.querySelector("time")?.getAttribute("datetime")).toBe(sender.lastReceivedAt);
});

it("ticks through the checkbox", async () => {
  const onToggle = vi.fn();
  await show({ checked: true, onToggle });
  const box = document.querySelector<HTMLElement>('[role="checkbox"]');
  expect(box?.getAttribute("aria-checked")).toBe("true");
  expect(box?.getAttribute("aria-label")).toBe("Select Northwind Weekly");
  await act(async () => box?.click());
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it("flags a spam-like sender", async () => {
  await show({ sender: { ...sender, spamLike: true } });
  expect(document.body.textContent).toContain("Looks like spam");
});

it("shows Skipping with a Stop button only for a skipped sender", async () => {
  const onStop = vi.fn();
  await show({ sender: { ...sender, skipInbox: true }, onStop });
  expect(document.body.textContent).toContain("Skipping");
  await act(async () =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Stop")?.click(),
  );
  expect(onStop).toHaveBeenCalledTimes(1);
  await show({ onStop });
  expect(document.body.textContent).not.toContain("Skipping");
});

it("names the account when the list has several", async () => {
  await show({ accountLabel: "Work" });
  expect(document.body.textContent).toContain("Work");
});
