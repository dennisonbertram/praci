// @vitest-environment jsdom

import type { RunActivityRow } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  runs: { list: vi.fn() },
  scratchpad: { waitingOnYou: vi.fn() },
}));
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
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Label: () => null,
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
  Skeleton: () => <div data-slot="skeleton" />,
}));

import { ActivityList } from "./ActivityList";

function Where() {
  return <output data-testid="where">{useLocation().search}</output>;
}
const inRouter = (node: ReactNode, path = "/") => (
  <MemoryRouter initialEntries={[path]}>
    <Where />
    {node}
  </MemoryRouter>
);
const view = (path?: string) => inRouter(<ActivityList onOpenRun={() => {}} />, path);

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

beforeEach(() => api.scratchpad.waitingOnYou.mockResolvedValue([]));

afterEach(() => {
  vi.unstubAllGlobals();
  api.runs.list.mockReset();
  api.scratchpad.waitingOnYou.mockReset();
  document.body.innerHTML = "";
});

it("turns a request that never answers into the error with Try again, which refetches in place", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  try {
    api.runs.list.mockImplementation(() => new Promise(() => {}));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(view()));
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load activity",
    );

    api.runs.list.mockResolvedValue({ runs: [run("a", "running")] });
    const calls = api.runs.list.mock.calls.length;
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    });
    expect(api.runs.list.mock.calls.length).toBeGreaterThan(calls);
    expect(container.querySelector('[data-testid="activity-list"]')).not.toBeNull();
    await act(async () => root.unmount());
  } finally {
    vi.useRealTimers();
  }
});

it("stops polling while the page is hidden and refetches quietly when it is shown again", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get");
  try {
    visibility.mockReturnValue("visible");
    api.runs.list.mockResolvedValue({ runs: [run("a", "running")] });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(view()));
    visibility.mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenCalls = api.runs.list.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(api.runs.list.mock.calls.length).toBe(hiddenCalls);

    visibility.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(api.runs.list.mock.calls.length).toBeGreaterThan(hiddenCalls);
    expect(container.textContent).not.toContain("Loading activity");
    await act(async () => root.unmount());
  } finally {
    visibility.mockRestore();
    vi.useRealTimers();
  }
});

it("lists items waiting on the person after Needs you, opens the bot, and hides when none", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockResolvedValue({ runs: [] });
  const item = {
    id: "item-1",
    botId: "bot-9",
    botName: "Ada (mock)",
    title: "Sign the sample form",
    waitingOn: "you",
    dueAt: null,
  };
  api.scratchpad.waitingOnYou.mockResolvedValue([item]);
  const onOpen = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(inRouter(<ActivityList onOpenRun={() => {}} onOpenWaitingItem={onOpen} />)),
  );

  expect(container.querySelector("#activity-waiting-heading")?.textContent).toBe("Waiting on you");
  const row = container.querySelector<HTMLButtonElement>(
    '[aria-labelledby="activity-waiting-heading"] [data-activity-row]',
  );
  expect(row?.textContent).toContain("Sign the sample form");
  expect(row?.textContent).toContain("Ada (mock)");
  expect(row?.textContent).toContain("Waiting on you");
  expect(container.textContent).not.toContain("Nothing needs you right now.");
  await act(async () => row?.click());
  expect(onOpen).toHaveBeenCalledWith(item);
});

it("shows a failed run error beneath its snippet", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockResolvedValue({
    runs: [{ ...run("failed", "failed"), error: "The job failed because the service timed out." }],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(view()));
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[data-testid="activity-show-finished"]')?.click(),
  );

  const row = container.querySelector<HTMLButtonElement>("[data-activity-row]");
  expect(row?.textContent).toContain("The job failed because the service timed out.");
  expect(
    row?.querySelector('[title="The job failed because the service timed out."]'),
  ).not.toBeNull();
  await act(async () => root.unmount());
});

it("hides the Waiting on you group when nothing waits", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.scratchpad.waitingOnYou.mockResolvedValue([]);
  api.runs.list.mockResolvedValue({ runs: [run("a", "waiting_input")] });
  const empty = document.createElement("div");
  document.body.append(empty);
  await act(async () => createRoot(empty).render(view()));
  expect(empty.querySelector("#activity-waiting-heading")).toBeNull();
});

it("reports only the bots whose runs the filters leave listed", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs: filter === "active" ? [run("a", "waiting_input")] : [],
  }));
  const listed = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(inRouter(<ActivityList onOpenRun={() => {}} onListedBots={listed} />)),
  );
  expect(listed).toHaveBeenLastCalledWith(new Set(["bot-1"]));
  await act(async () => root.unmount());

  // The same filter, set in the URL, leaves no bot listed.
  const second = createRoot(container);
  await act(async () =>
    second.render(
      inRouter(
        <ActivityList onOpenRun={() => {}} onListedBots={listed} />,
        "/?activity-status=running",
      ),
    ),
  );
  expect(listed).toHaveBeenLastCalledWith(new Set());
  await act(async () => second.unmount());
});

it("keeps the search, status, dates and sort in the URL under their own names", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs:
      filter === "active"
        ? [
            { ...run("a", "running"), botName: "Zed", updatedAt: "2026-01-02T00:00:00.000Z" },
            { ...run("b", "running"), botName: "Ann", updatedAt: "2026-01-01T00:00:00.000Z" },
          ]
        : [],
  }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const order = () =>
    [...container.querySelectorAll("[data-activity-row]")].map((r) =>
      r.getAttribute("aria-label")?.includes("Zed") ? "Zed" : "Ann",
    );
  await act(async () => root.render(view("/?q=keep&activity-sort=bot&activity-dir=asc")));
  const where = () => container.querySelector("[data-testid='where']")?.textContent;
  // Sorted by bot name from the URL; the page's own ?q= is left alone.
  expect(order()).toEqual(["Ann", "Zed"]);
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[data-testid="activity-show-filters"]')?.click(),
  );
  const search = document.querySelector<HTMLInputElement>("input[type='search']");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "zed");
    search?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(where()).toContain("activity-q=zed");
  expect(where()).toContain("q=keep");
  expect(order()).toEqual(["Zed"]);
  await act(async () =>
    document.querySelector<HTMLButtonElement>('[data-testid="activity-reset-filters"]')?.click(),
  );
  expect(where()).not.toContain("activity-q");
  expect(order()).toEqual(["Ann", "Zed"]);
  await act(async () => root.unmount());
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
  // The list no longer caps its own height; it keeps its size and the sidebar scrolls.
  expect(container.querySelector('[data-testid="activity-list"]')?.className).toContain("shrink-0");
  expect(container.textContent).not.toContain("Finished");
  const toggle = container.querySelector<HTMLButtonElement>(
    '[data-testid="activity-show-finished"]',
  );
  expect(toggle?.textContent).toBe("Show 2 finished runs");

  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  await act(async () => toggle?.click());
  expect(container.textContent).toContain("Finished");
  // The Finished heading is brought into view, and the rows are not clipped by a height cap.
  expect(scrollIntoView).toHaveBeenCalled();
  expect(
    container.querySelector<HTMLElement>('[data-testid="activity-rows"]')?.style.maxHeight,
  ).toBe("");
  expect(container.querySelectorAll('button[aria-label$=", Done"]')).toHaveLength(2);
});

it("keeps quiet routine runs out of the Finished count and shows them dimmed without the prompt", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.runs.list.mockImplementation(async ({ filter }: { filter: string }) => ({
    runs:
      filter === "active"
        ? []
        : [run("b", "completed"), { ...run("q", "completed"), silent: true }],
  }));
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(view()));
  const toggle = container.querySelector<HTMLButtonElement>(
    '[data-testid="activity-show-finished"]',
  );
  expect(toggle?.textContent).toBe("Show 1 finished run");
  Element.prototype.scrollIntoView = vi.fn();
  await act(async () => toggle?.click());
  const quiet = container.querySelector('button[aria-label$=", Nothing to report"]');
  expect(quiet).not.toBeNull();
  expect(quiet?.textContent).toContain("Nothing to report");
  expect(quiet?.textContent).not.toContain(run("q", "completed").promptSnippet);
  expect(container.querySelectorAll('button[aria-label$=", Done"]')).toHaveLength(1);
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
  const status = document.querySelector("input[type='search']");
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

it("names a held approval 'Needs approval' and a held question 'Needs your answer', on their own line", async () => {
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
    "Investor Relations (mock), Needs approval",
    "Investor Relations (mock), Needs your answer",
  ]);
  const row = container.querySelector("[data-activity-row]");
  const statusLine = [...(row?.querySelectorAll("span.block") ?? [])].map((s) => s.textContent);
  expect(statusLine).toEqual(["Needs approval", "Draft the update"]);
  // The group heading is for screen readers only; each row carries its own state.
  expect(container.querySelector("#activity-needs-heading")?.className).toBe("sr-only");
});

it("shows the active runs before the finished runs arrive, and reports their bots", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let finish: (value: { runs: RunActivityRow[] }) => void = () => {};
  api.runs.list.mockImplementation(({ filter }: { filter: string }) =>
    filter === "active"
      ? Promise.resolve({ runs: [run("a", "waiting_input")] })
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const listed = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      inRouter(<ActivityList onOpenRun={() => {}} onListedBots={listed} />),
    ),
  );

  expect(container.querySelector('button[aria-label$=", Needs your answer"]')).not.toBeNull();
  expect(listed).toHaveBeenLastCalledWith(new Set(["bot-1"]));
  await act(async () => finish({ runs: [] }));
});
