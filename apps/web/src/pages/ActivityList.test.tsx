// @vitest-environment jsdom

import type { RunActivityRow } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ runs: { list: vi.fn() } }));
vi.mock("../lib/rpc", () => ({ rpc: api }));
vi.mock("../lib/roster-time", () => ({ formatRosterTime: () => "9:00 AM" }));
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
vi.mock("@rakazo/ui-web", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/ui-web")>()),
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
  expect(container.querySelector("#activity-needs-heading")?.textContent).toBe("Needs you");
  // Height stays bounded so the chat roster below remains visible, yet holds about five rows.
  expect(container.querySelector('[data-testid="activity-list"]')?.className).toContain(
    "max-h-[40vh]",
  );
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

it("opens the filter form in a popover so it never takes the list's space", async () => {
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
  const status = document.querySelector('[data-testid="activity-status-filter"]');
  expect(status).not.toBeNull();
  // The form lives outside the activity list, so the rows keep their whole window.
  expect(container.contains(status)).toBe(false);
  // It opens beside the sidebar, not over the rows beneath the button.
  expect(document.querySelector("[data-side]")?.getAttribute("data-side")).toBe("right");
  expect(container.querySelector('button[aria-label$=", Needs your answer"]')).not.toBeNull();
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

it("names a held approval and a held question the same, 'Needs your answer', on their own line", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs:
      filter === "active"
        ? [{ ...run("a", "waiting_input"), needsApproval: true }, run("b", "waiting_input")]
        : [],
  }));
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(view()));

  const labels = [...container.querySelectorAll("[data-activity-row]")].map((row) =>
    row.getAttribute("aria-label"),
  );
  expect(labels).toEqual([
    "Investor Relations (mock), Needs your answer",
    "Investor Relations (mock), Needs your answer",
  ]);
  const row = container.querySelector("[data-activity-row]");
  const statusLine = [...(row?.querySelectorAll("span.block") ?? [])].map((s) => s.textContent);
  expect(statusLine).toEqual(["Needs your answer", "Draft the update"]);
  // The group heading is for screen readers only; each row carries its own state.
  expect(container.querySelector("#activity-needs-heading")?.className).toBe("sr-only");
});
