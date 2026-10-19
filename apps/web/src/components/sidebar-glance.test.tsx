// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));

import { glanceBadge, runwayGlance, UrgentMark } from "./sidebar-glance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const container = document.createElement("div");
afterEach(() => act(() => createRoot(container).unmount()));

const html = (node: React.ReactNode) => {
  act(() => createRoot(container).render(node));
  return container.innerHTML;
};

it("shows a dot labelled new while notifications are unseen, instead of the value", () => {
  const badge = glanceBadge({ unseen: 2, value: "3", rail: false });
  expect(badge.badgeLabel).toBe("new");
  expect(html(badge.badge)).toContain('data-testid="glance-dot"');
  expect(container.textContent).not.toContain("3");
});

it("shows the value when nothing is unseen, and nothing when there is no value", () => {
  const badge = glanceBadge({ unseen: 0, value: "3", valueLabel: "3 unread", rail: false });
  expect(badge.badgeLabel).toBe("3 unread");
  html(badge.badge);
  expect(container.textContent).toBe("3");
  expect(glanceBadge({ unseen: 0, rail: false }).badge).toBeNull();
});

it("keeps a value out of the rail, where any badge becomes a dot", () => {
  expect(glanceBadge({ unseen: 0, value: "3", rail: true }).badge).toBeNull();
  expect(glanceBadge({ unseen: 1, rail: true }).badge).not.toBeNull();
});

it("writes runway as months and hides it with Hide money or without a figure", () => {
  expect(runwayGlance(24.4, false)).toBe("24 mo");
  expect(runwayGlance(24.4, true)).toBeUndefined();
  expect(runwayGlance(null, false)).toBeUndefined();
});

it("names the urgent mark for screen readers", () => {
  html(<UrgentMark />);
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(container.textContent).toContain("(urgent)");
});
