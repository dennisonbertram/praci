// @vitest-environment jsdom

import type { RunActivityRow } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ runs: { list: vi.fn() } }));
vi.mock("../lib/rpc", () => ({ rpc: api }));
vi.mock("../lib/relative-time", () => ({ formatRelativeTime: () => "just now" }));
const join = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      String.raw(parts, ...values),
);
vi.mock("@lingui/core/macro", () => ({
  t: join,
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: join }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    size: _size,
    variant: _variant,
    ...props
  }: ComponentProps<"button"> & { size?: string; variant?: string }) => <button {...props} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Label: () => null,
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
  Skeleton: () => <div data-slot="skeleton" />,
}));

import { ActivityList } from "./ActivityList";

const view = () => <ActivityList onOpenRun={() => {}} />;

const run = (runId: string, status: RunActivityRow["status"]): RunActivityRow =>
  ({
    runId,
    botId: "bot-1",
    botName: "Investor Relations (mock)",
    groupId: null,
    groupName: null,
    status,
    promptSnippet: "Draft the update",
    updatedAt: new Date().toISOString(),
  }) as RunActivityRow;

afterEach(() => {
  vi.unstubAllGlobals();
  api.runs.list.mockReset();
  document.body.innerHTML = "";
});

it("leads with what needs the founder and folds finished runs until asked", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs:
      filter === "active"
        ? [run("a", "waiting_input")]
        : [run("b", "completed"), run("c", "completed")],
  }));
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(view()));

  expect(container.textContent).toContain("Needs you");
  expect(container.textContent).not.toContain("Finished");
  const toggle = container.querySelector<HTMLButtonElement>(
    '[data-testid="activity-show-finished"]',
  );
  expect(toggle?.textContent).toBe("Show 2 finished runs");

  await act(async () => toggle?.click());
  expect(container.textContent).toContain("Finished");
  expect(container.querySelectorAll('button[aria-label$=", Done"]')).toHaveLength(2);
});

it("says nothing needs the founder when only finished runs exist", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs: filter === "active" ? [] : [run("b", "completed")],
  }));
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(view()));

  expect(container.textContent).toContain("Nothing needs you right now.");
  expect(container.textContent).toContain("Show 1 finished run");
});

it("keeps the Activity header and Filter toggle visible while the filter form is open", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs: filter === "active" ? [run("a", "waiting_input")] : [],
  }));
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(view()));

  const toggle = () =>
    container.querySelector<HTMLButtonElement>('[data-testid="activity-show-filters"]');
  await act(async () => toggle()?.click());
  expect(container.querySelector('[data-testid="activity-status-filter"]')).not.toBeNull();
  expect(container.querySelector("h2")?.textContent).toBe("Activity");
  expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
  // The filter form scrolls with the rows, so it cannot squeeze them to zero height.
  const rows = container.querySelector('[data-testid="activity-rows"]');
  expect(rows?.contains(container.querySelector('[data-testid="activity-status-filter"]'))).toBe(
    true,
  );

  await act(async () => toggle()?.click());
  expect(container.querySelector('[data-testid="activity-status-filter"]')).toBeNull();
});

it("does not shrink inside the sidebar's scrolling flex column, and scrolls its rows inside", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs: filter === "active" ? [run("a", "waiting_input")] : [],
  }));
  const parent = document.createElement("div");
  parent.className = "flex flex-col overflow-y-auto";
  document.body.append(parent);
  await act(async () => createRoot(parent).render(view()));

  const root = parent.querySelector<HTMLElement>('[data-testid="activity-list"]');
  expect(root?.classList.contains("shrink-0")).toBe(true);
  const rows = parent.querySelector<HTMLElement>('[data-testid="activity-rows"]');
  expect(rows?.classList.contains("overflow-y-auto")).toBe(true);
  // The header and Filter toggle stay outside the scrolling rows.
  expect(rows?.contains(parent.querySelector("h2"))).toBe(false);
});
