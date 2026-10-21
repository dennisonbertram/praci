// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));

import { OPENING_SLOW_MS, OpeningSpace } from "./ShellSkeleton";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

it("offers Try again once opening takes longer than the wait, and not before", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  const reload = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(<OpeningSpace onRetry={reload} />));
  expect(container.textContent).toContain("Opening your Space…");
  expect(container.querySelector("button")).toBeNull();
  await act(async () => void vi.advanceTimersByTime(OPENING_SLOW_MS));
  expect(container.textContent).toContain("Still opening…");
  const retry = container.querySelector("button");
  expect(retry?.textContent).toBe("Try again");
  await act(async () => retry?.click());
  expect(reload).toHaveBeenCalledTimes(1);
});
