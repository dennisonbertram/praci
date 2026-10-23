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

import { glanceBadge, rowStatusKind, StatusMark } from "./sidebar-glance";

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

it("keeps the failed count over the new dot, and the dot when nothing failed", () => {
  const badge = glanceBadge({
    unseen: 2,
    value: "1",
    valueLabel: "1 failed",
    failure: true,
    rail: false,
  });
  expect(badge.badgeLabel).toBe("1 failed");
  expect(html(badge.badge)).toContain("glance-value");
  expect(glanceBadge({ unseen: 2, value: "1", failure: true, rail: true }).badgeLabel).toBe("new");
});

it("shows the value when nothing is unseen, and nothing when there is no value", () => {
  const badge = glanceBadge({ unseen: 0, value: "3", valueLabel: "3 unread", rail: false });
  expect(badge.badgeLabel).toBe("3 unread");
  html(badge.badge);
  expect(container.textContent).toBe("3");
  // A mouse user hovering the number sees what it counts.
  expect(container.querySelector("[data-testid=glance-value]")?.getAttribute("title")).toBe(
    "3 unread",
  );
  expect(glanceBadge({ unseen: 0, rail: false }).badge).toBeNull();
});

it("colors a failure count with the destructive token, not the muted one", () => {
  html(glanceBadge({ unseen: 0, value: "2", failure: true, rail: false }).badge);
  const value = container.querySelector("[data-testid=glance-value]");
  expect(value?.className).toContain("text-destructive");
  html(glanceBadge({ unseen: 0, value: "2", rail: false }).badge);
  expect(container.querySelector("[data-testid=glance-value]")?.className).not.toContain(
    "text-destructive",
  );
});

it("keeps a value out of the rail, where any badge becomes a dot", () => {
  expect(glanceBadge({ unseen: 0, value: "3", rail: true }).badge).toBeNull();
  expect(glanceBadge({ unseen: 1, rail: true }).badge).not.toBeNull();
});

it.each([
  ["urgent", "(urgent)"],
  ["needs_input", "(needs your answer)"],
  ["failed", "(failed)"],
  ["done", "(done)"],
  ["new", "(new)"],
] as const)("names the %s mark for screen readers", (kind, label) => {
  html(<StatusMark kind={kind} botId="bot-1" />);
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(container.textContent).toContain(label);
  // Sighted mouse users get the same words on hover.
  expect(container.querySelector("[data-kind]")?.getAttribute("title")).toBeTruthy();
});

it("gives each agent its own animation phase", () => {
  const phase = (botId: string) => {
    html(<StatusMark kind="urgent" botId={botId} />);
    return container.querySelector("svg")?.getAttribute("style");
  };
  expect(phase("bot-1")).not.toEqual(phase("bot-2"));
  expect(phase("bot-1")).toEqual(phase("bot-1"));
});

it("shows a failed mark while the roster records a run error", () => {
  expect(rowStatusKind("failed", "run-1")).toBe("failed");
  expect(rowStatusKind("failed", undefined)).toBeUndefined();
  expect(rowStatusKind("failed", null)).toBeUndefined();
  expect(rowStatusKind("done", null)).toBe("done");
  expect(rowStatusKind(undefined, "run-1")).toBeUndefined();
});
