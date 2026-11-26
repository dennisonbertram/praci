// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ mcpConnections: { activity: vi.fn() } }));
vi.mock("../lib/rpc", () => ({ rpc: api }));
const join = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      String.raw(parts, ...values),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: join, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/ui-web")>()),
  Button: ({
    size: _size,
    variant: _variant,
    ...props
  }: ComponentProps<"button"> & { size?: string; variant?: string }) => <button {...props} />,
  Skeleton: () => <div data-slot="skeleton" />,
}));

import { McpConnectionActivity } from "./McpConnectionActivity";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  api.mcpConnections.activity.mockReset();
  document.body.innerHTML = "";
});

it("offers Try again after a failed load and shows the calls once it works", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.mcpConnections.activity
    .mockRejectedValueOnce(new Error("boom"))
    .mockResolvedValueOnce([
      { tool: "finance_overview", outcome: "ok", createdAt: "2026-10-27T09:31:10.000Z" },
    ]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<McpConnectionActivity connectionId="c1" />));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not load activity",
  );
  await act(async () => {
    container.querySelector<HTMLButtonElement>("button")?.click();
  });
  expect(container.textContent).toContain("finance_overview");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
});

it("renders two calls of the same tool at the same instant as two rows without key warnings", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const call = { tool: "contacts_add", outcome: "ok", createdAt: "2026-10-27T09:31:10.000Z" };
  api.mcpConnections.activity.mockResolvedValue([call, call]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<McpConnectionActivity connectionId="c1" />));
  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(spy.mock.calls.some((args) => String(args[0]).includes("same key"))).toBe(false);
  await act(async () => root.unmount());
});
