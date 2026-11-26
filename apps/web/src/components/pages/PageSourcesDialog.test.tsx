// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sources: vi.fn() }));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { pages: { sources: mocks.sources } } }));

import { PageSourcesDialog } from "./PageSourcesDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  mocks.sources.mockReset();
});

const source = (overrides: Record<string, unknown>) => ({
  id: "s1",
  pageId: "p1",
  name: "Cash",
  kind: "praci",
  call: { tool: "finance_overview", args: {} },
  schedule: "1h",
  status: "active",
  lastRefreshAt: "2026-01-01T09:00:00.000Z",
  lastError: null,
  ...overrides,
});

function mount(pageId: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const render = (id: string) =>
    act(async () => {
      root.render(
        <PageSourcesDialog
          botId="b"
          pageId={id}
          open
          onOpenChange={() => {}}
          onChanged={() => {}}
        />,
      );
    });
  return {
    render: () => render(pageId),
    rerender: render,
  };
}

it("labels an auto-paused source with an error as paused, not failed", async () => {
  mocks.sources.mockResolvedValue([source({ status: "paused", lastError: "Request timed out" })]);
  await mount("p1").render();
  const text = document.body.textContent ?? "";
  expect(text).toContain("paused");
  expect(text).not.toContain("failed");
});

it("shows the error under a failed row", async () => {
  mocks.sources.mockResolvedValue([source({ lastError: "Request timed out" })]);
  await mount("p1").render();
  const line = document.body.querySelector('[title="Request timed out"]');
  expect(line?.textContent).toBe("Request timed out");
  expect(document.body.textContent).toContain("failed");
});

it("shows the loading skeleton before the request resolves", async () => {
  mocks.sources.mockReturnValue(new Promise(() => {}));
  await mount("p1").render();
  expect(document.body.querySelector('[role="status"]')).not.toBeNull();
});

it("retries a failed load and shows the source rows", async () => {
  let resolveSources: ((sources: ReturnType<typeof source>[]) => void) | undefined;
  mocks.sources
    .mockRejectedValueOnce(new Error("Could not reach the server"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSources = resolve;
        }),
    );
  const view = mount("p1");
  await view.render();
  expect(document.body.querySelector('[role="alert"]')).not.toBeNull();

  const retry = [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent === "Retry",
  );
  expect(retry).toBeDefined();
  await act(async () => {
    retry?.click();
  });
  expect(document.body.querySelector('[role="status"]')).not.toBeNull();

  await act(async () => resolveSources?.([source({ name: "Recovered source" })]));
  expect(document.body.textContent).toContain("Recovered source");
  expect(mocks.sources).toHaveBeenCalledTimes(2);
});

it("does not show the previous page's rows after the page changes", async () => {
  mocks.sources.mockResolvedValueOnce([source({ name: "Old page source" })]);
  const view = mount("p1");
  await view.render();
  expect(document.body.textContent).toContain("Old page source");
  mocks.sources.mockReturnValue(new Promise(() => {}));
  await view.rerender("p2");
  expect(document.body.textContent).not.toContain("Old page source");
});
