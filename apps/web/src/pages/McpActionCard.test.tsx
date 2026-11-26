// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const { translate } = vi.hoisted(() => {
  const translate = (first: unknown, ...values: unknown[]) => {
    if (Array.isArray(first)) {
      return (first as string[]).reduce(
        (out, part, i) => out + part + String(values[i] ?? ""),
        "",
      );
    }
    if (first && typeof first === "object" && "message" in first) {
      const descriptor = first as { message: string; values?: Record<string, unknown> };
      return descriptor.message.replace(
        /\{(\w+)\}/g,
        (_, key: string) => String(descriptor.values?.[key] ?? `{${key}}`),
      );
    }
    return String(first ?? "");
  };
  return { translate };
});
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ _: translate, t: translate, i18n: { locale: "en" } }),
  Trans: ({ children, message }: { children?: ReactNode; message?: string }) =>
    message ?? children,
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ _: translate, t: translate, i18n: { locale: "en" } }),
  Trans: ({ children, message }: { children?: ReactNode; message?: string }) =>
    message ?? children,
}));
vi.mock("@lingui/core/macro", () => ({ t: translate }));
vi.mock("@lingui/core", () => ({ i18n: { _: translate, locale: "en" } }));

import { McpActionCard } from "./McpActionCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("says a saved allow still follows the space permission level", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const onDecide = vi.fn();
  act(() =>
    createRoot(container).render(
      <McpActionCard
        action={
          {
            id: "a1",
            connectionLabel: "Claude",
            tool: "send_note",
            args: {},
          } as never
        }
        busy={false}
        onDecide={onDecide}
      />,
    ),
  );
  expect(container.textContent).toContain("Approve and save an Allow rule");
  expect(container.textContent).toContain("Stricter space permissions can still require approval.");
  const allow = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Approve and save an Allow rule"),
  );
  act(() => allow?.click());
  expect(onDecide).toHaveBeenCalledWith("approve", true);
});

it("does not offer a saved allow for a payment that always needs approval", () => {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(
      <McpActionCard
        action={
          {
            id: "payment-1",
            connectionLabel: "Finance",
            tool: "mcp__finance-mercury__requestSendMoney",
            args: { amount: 100, recipient: "Example" },
          } as never
        }
        busy={false}
        onDecide={() => undefined}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Approve and save an Allow rule");
});

it("shows how long the request has waited", () => {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(
      <McpActionCard
        action={
          {
            id: "a2",
            connectionLabel: "Claude",
            tool: "send_note",
            args: {},
            createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          } as never
        }
        busy={false}
        onDecide={() => undefined}
      />,
    ),
  );
  expect(container.textContent).toContain("5m ago");
  expect(container.textContent).toContain("Claude");
  expect(container.textContent).toContain("send_note");
});
