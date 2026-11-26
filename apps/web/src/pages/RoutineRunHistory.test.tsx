// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { RoutineRun } from "@rakazo/contracts";
import { PINNED_CONNECTION_LOST_MESSAGE } from "@rakazo/contracts";
import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { routines: api } }));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    size: _size,
    variant: _variant,
    ...props
  }: ComponentProps<"button"> & { size?: string; variant?: string }) => <button {...props} />,
}));

import { RoutineRunHistory } from "./RoutineRunHistory";

i18n.loadAndActivate({ locale: "en", messages: {} });

const run: RoutineRun = {
  id: "run-1",
  botId: "bot-1",
  groupId: null,
  status: "completed",
  error: null,
  createdAt: "2026-01-02T12:00:00Z",
  startedAt: "2026-01-02T12:00:00Z",
  completedAt: "2026-01-02T12:01:22Z",
  messageId: "reply-1",
  preview: "Cash is steady.",
};
const page = (runs: RoutineRun[]) => ({ runs, nextCursor: null });
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  api.history.mockReset();
});
async function mounted(
  routineId = "routine-1",
  name?: string,
  props: Partial<ComponentProps<typeof RoutineRunHistory>> = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async (id: string) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <I18nProvider i18n={i18n}>
            <RoutineRunHistory key={id} routineId={id} name={name} {...props} />
          </I18nProvider>
        </MemoryRouter>,
      ),
    );
  await render(routineId);
  return {
    container,
    render,
    close: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
it("keeps loaded runs visible when Refresh fails", async () => {
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: run.id, createdAt: run.createdAt };
  let rejectRefresh!: (error: Error) => void;
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockResolvedValueOnce(page([older]))
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((_resolve, reject) => {
        rejectRefresh = reject;
      }),
    );
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    expect(view.container.querySelectorAll("li")).toHaveLength(2);

    await act(async () => button("Refresh").click());
    expect(view.container.querySelectorAll("li")).toHaveLength(2);
    expect(view.container.textContent).not.toContain("Loading…");
    expect(button("Refresh").disabled).toBe(true);

    await act(async () => rejectRefresh(new Error("offline")));
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load run history",
    );
    expect(view.container.querySelectorAll("li")).toHaveLength(2);
    expect(button("Refresh").disabled).toBe(false);
  } finally {
    await view.close();
  }
});
it("refreshes the newest run while retaining older pages and their cursor", async () => {
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: "run-1", createdAt: run.createdAt };
  const olderCursor = { id: "older", createdAt: older.createdAt };
  const newest = { ...run, id: "newest", messageId: "newest-reply" };
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockResolvedValueOnce({ runs: [older], nextCursor: olderCursor })
    .mockResolvedValueOnce({
      runs: [newest, run],
      nextCursor: { id: "newest", createdAt: newest.createdAt },
    })
    .mockResolvedValueOnce(page([{ ...older, id: "oldest" }]));
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await act(async () => button("Refresh").click());
    const rows = [...view.container.querySelectorAll("[data-testid='routine-run-row']")];
    expect(rows.map((row) => row.querySelector("a")?.getAttribute("href"))).toEqual([
      "/app/bot-1?m=newest-reply",
      "/app/bot-1?m=reply-1",
      "/app/bot-1?m=older-reply",
    ]);
    expect(button("Refresh").disabled).toBe(false);
    await act(async () => button("Load older runs").click());
    expect(api.history).toHaveBeenLastCalledWith({ routineId: "routine-1", before: olderCursor });
    expect(view.container.querySelectorAll("[data-testid='routine-run-row']")).toHaveLength(4);
  } finally {
    await view.close();
  }
});
it("drops older pages after a no-overlap refresh and does not refetch on collapse", async () => {
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: run.id, createdAt: run.createdAt };
  const newest = { ...run, id: "newest", messageId: "newest-reply" };
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockResolvedValueOnce(page([older]))
    .mockResolvedValueOnce({ runs: [newest], nextCursor: cursor });
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await act(async () => button("Refresh").click());
    expect(view.container.querySelectorAll("[data-testid='routine-run-row']")).toHaveLength(1);
    await act(async () => button("Run history").click());
    const callsBeforeReopen = api.history.mock.calls.length;
    await act(async () => button("Run history").click());
    expect(api.history).toHaveBeenCalledTimes(callsBeforeReopen);
    expect(view.container.querySelectorAll("[data-testid='routine-run-row']")).toHaveLength(1);
  } finally {
    await view.close();
  }
});
it("ignores a pending older page after a no-overlap run-state refresh", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: run.id, createdAt: run.createdAt };
  const newest = { ...run, id: "newest", messageId: "newest-reply" };
  let finishOlder!: (result: ReturnType<typeof page>) => void;
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((resolve) => {
        finishOlder = resolve;
      }),
    )
    .mockResolvedValueOnce({ runs: [newest], nextCursor: cursor });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (running: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <I18nProvider i18n={i18n}>
            <RoutineRunHistory routineId="routine-1" running={running} />
          </I18nProvider>
        </MemoryRouter>,
      ),
    );
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await render(false);
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await render(true);
    await act(async () => finishOlder(page([{ ...older, id: "oldest" }])));
    expect(
      [...container.querySelectorAll("[data-testid='routine-run-row']")].map((row) =>
        row.querySelector("a")?.getAttribute("href"),
      ),
    ).toEqual(["/app/bot-1?m=newest-reply"]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
it("disables Refresh while older runs are loading", async () => {
  const cursor = { id: run.id, createdAt: run.createdAt };
  let finishOlder!: (result: ReturnType<typeof page>) => void;
  api.history.mockResolvedValueOnce({ runs: [run], nextCursor: cursor }).mockReturnValueOnce(
    new Promise<ReturnType<typeof page>>((resolve) => {
      finishOlder = resolve;
    }),
  );
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    expect(button("Refresh").disabled).toBe(true);
    await act(async () => finishOlder(page([{ ...run, id: "older" }])));
    expect(button("Refresh").disabled).toBe(false);
  } finally {
    await view.close();
  }
});
it("shows an alert when a run-state refresh fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let rejectStateRefresh!: (error: Error) => void;
  const newer = { ...run, id: "newer", messageId: "newer-reply" };
  api.history
    .mockResolvedValueOnce(page([run]))
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((_resolve, reject) => {
        rejectStateRefresh = reject;
      }),
    )
    .mockResolvedValue(page([newer]));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (running: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <I18nProvider i18n={i18n}>
            <RoutineRunHistory routineId="routine-1" running={running} />
          </I18nProvider>
        </MemoryRouter>,
      ),
    );
  try {
    await render(false);
    await render(true);
    await act(async () => rejectStateRefresh(new Error("offline")));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load run history",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
it("shows loading, then the real run and its exact message link", async () => {
  let finish!: (rows: RoutineRun[]) => void;
  api.history.mockReturnValue(
    new Promise<RoutineRun[]>((resolve) => {
      finish = resolve;
    }).then(page),
  );
  const view = await mounted();
  try {
    expect(view.container.textContent).toContain("Loading");
    expect(view.container.textContent).not.toContain("No runs yet");
    await act(async () => finish([run]));
    expect(view.container.querySelectorAll("li")).toHaveLength(1);
    expect(view.container.textContent).toContain("1m 22s");
    expect(view.container.textContent).toContain("Cash is steady.");
    expect(view.container.querySelector("a")?.getAttribute("href")).toBe("/app/bot-1?m=reply-1");
  } finally {
    await view.close();
  }
});
it("shows a genuine empty state and refreshes while the panel is open", async () => {
  vi.useFakeTimers();
  api.history
    .mockResolvedValueOnce(page([]))
    .mockResolvedValueOnce(page([{ ...run, messageId: null }]));
  const view = await mounted();
  try {
    expect(view.container.textContent).toContain("No runs yet");
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(view.container.querySelectorAll("li")).toHaveLength(1);
    expect(view.container.querySelector("a")).toBeNull();
    await view.close();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.history).toHaveBeenCalledTimes(2);
  } catch (error) {
    await view.close();
    throw error;
  }
});
it("shows failures honestly, preserves previous results and recovers on the next refresh", async () => {
  vi.useFakeTimers();
  api.history
    .mockResolvedValueOnce(page([run]))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(page([]));
  const view = await mounted();
  try {
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
    expect(view.container.querySelectorAll("li")).toHaveLength(1);
    expect(view.container.textContent).not.toContain("No runs yet");
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    expect(view.container.textContent).toContain("No runs yet");
  } finally {
    await view.close();
  }
});
it("discards a response from the previous routine", async () => {
  let finish!: (rows: RoutineRun[]) => void;
  api.history
    .mockReturnValueOnce(
      new Promise<RoutineRun[]>((resolve) => {
        finish = resolve;
      }).then(page),
    )
    .mockResolvedValueOnce(page([]));
  const view = await mounted();
  try {
    await view.render("routine-2");
    await act(async () => finish([run]));
    expect(view.container.textContent).toContain("No runs yet");
    expect(view.container.querySelectorAll("li")).toHaveLength(0);
  } finally {
    await view.close();
  }
});
it("defaults to the latest run, expands all entries, and loads older pages", async () => {
  vi.useFakeTimers();
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: "run-1", createdAt: run.createdAt };
  api.history.mockImplementation(async (input: { before?: unknown }) =>
    input.before
      ? page([{ ...older, id: "oldest", messageId: null }])
      : { runs: [run, older], nextCursor: cursor },
  );
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    expect(view.container.querySelectorAll("li")).toHaveLength(1);
    expect(button("Run history").getAttribute("aria-expanded")).toBe("false");
    await act(async () => button("Run history").click());
    expect(button("Run history").getAttribute("aria-expanded")).toBe("true");
    expect(view.container.querySelectorAll("li")).toHaveLength(2);
    await act(async () => button("Load older runs").click());
    expect(api.history).toHaveBeenLastCalledWith({ routineId: "routine-1", before: cursor });
    expect(view.container.querySelectorAll("li")).toHaveLength(3);
    expect(view.container.textContent).not.toContain("Load older runs");
    await act(async () => button("Run history").click());
    expect(view.container.querySelectorAll("li")).toHaveLength(1);
    const requests = api.history.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(api.history).toHaveBeenCalledTimes(requests + 1);
    await act(async () => button("Run history").click());
    expect(view.container.querySelectorAll("li")).toHaveLength(2);
    expect(api.history).toHaveBeenCalledTimes(requests + 1);
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(api.history).toHaveBeenCalledTimes(requests + 1);
  } finally {
    await view.close();
  }
});
it("ignores a collapse refresh after expanded browsing resumes", async () => {
  let finish!: (value: ReturnType<typeof page>) => void;
  const cursor = { id: run.id, createdAt: run.createdAt };
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockResolvedValueOnce(page([{ ...run, id: "older" }]))
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((resolve) => {
        finish = resolve;
      }),
    );
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await act(async () => button("Run history").click());
    await act(async () => button("Run history").click());
    await act(async () => finish(page([run])));
    expect(view.container.querySelectorAll("li")).toHaveLength(2);
  } finally {
    await view.close();
  }
});
it("ignores a collapsed poll after expanding and loading older runs", async () => {
  vi.useFakeTimers();
  let finish!: (value: ReturnType<typeof page>) => void;
  const cursor = { id: run.id, createdAt: run.createdAt };
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce(page([{ ...run, id: "older" }]));
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await act(async () => finish(page([run])));
    expect(view.container.querySelectorAll("li")).toHaveLength(2);
  } finally {
    await view.close();
  }
});

it("keeps a newer collapsed page when an older refresh finishes last", async () => {
  vi.useFakeTimers();
  let releaseOlder!: (value: ReturnType<typeof page>) => void;
  const cursor = { id: run.id, createdAt: run.createdAt };
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: cursor })
    .mockResolvedValueOnce(page([{ ...run, id: "older" }]))
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((resolve) => {
        releaseOlder = resolve;
      }),
    )
    .mockResolvedValueOnce(page([{ ...run, status: "failed" }]));
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await act(async () => button("Run history").click());
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(view.container.textContent).toContain("Failed");
    await act(async () => releaseOlder(page([run])));
    expect(view.container.textContent).toContain("Failed");
    expect(view.container.textContent).not.toContain("Done");
  } finally {
    await view.close();
  }
});
it("accepts a successful collapse refresh when the overlapping poll fails", async () => {
  vi.useFakeTimers();
  let finish!: (value: ReturnType<typeof page>) => void;
  api.history
    .mockResolvedValueOnce({ runs: [run], nextCursor: { id: run.id, createdAt: run.createdAt } })
    .mockResolvedValueOnce(page([{ ...run, id: "older" }]))
    .mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((resolve) => {
        finish = resolve;
      }),
    )
    .mockRejectedValueOnce(new Error("temporarily unavailable"));
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    await act(async () => button("Run history").click());
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(view.container.textContent).toContain("Could not load run history");
    await act(async () => finish(page([{ ...run, status: "failed" }])));
    expect(view.container.textContent).toContain("Failed");
    expect(view.container.textContent).not.toContain("Could not load run history");
  } finally {
    await view.close();
  }
});

it("links View chat into the group thread when the run has a groupId", async () => {
  api.history.mockResolvedValue(page([{ ...run, groupId: "group-1", messageId: "reply-1" }]));
  const view = await mounted();
  try {
    expect(view.container.querySelector("a")?.getAttribute("href")).toBe(
      "/app/g/group-1?m=reply-1",
    );
  } finally {
    await view.close();
  }
});
it("keeps loaded older runs while expanded, and refreshes to the first page on collapse", async () => {
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: "run-1", createdAt: run.createdAt };
  api.history.mockImplementation(async (input: { before?: unknown }) =>
    input.before
      ? page([{ ...older, id: "oldest", messageId: null }])
      : { runs: [run, older], nextCursor: cursor },
  );
  const view = await mounted();
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    expect(view.container.querySelectorAll("li")).toHaveLength(3);
    expect(view.container.textContent).not.toContain("Load older runs");
    await act(async () => button("Run history").click());
    expect(view.container.querySelectorAll("li")).toHaveLength(1);
    expect(button("Run history").getAttribute("aria-expanded")).toBe("false");
  } finally {
    await view.close();
  }
});

it("says Running at once when a test run was just started and no row exists yet", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.history.mockResolvedValue(page([]));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <I18nProvider i18n={i18n}>
          <RoutineRunHistory routineId="routine-1" running />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("Running…");
  expect(container.textContent).not.toContain("No runs yet");
  await act(async () => root.unmount());
  container.remove();
});

it("keeps loaded older runs when a run finishes while they are open", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const older = { ...run, id: "older", messageId: "older-reply" };
  const cursor = { id: "run-1", createdAt: run.createdAt };
  api.history.mockImplementation(async (input: { before?: unknown }) =>
    input.before ? page([{ ...older, id: "oldest" }]) : { runs: [run, older], nextCursor: cursor },
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (running: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <I18nProvider i18n={i18n}>
            <RoutineRunHistory routineId="routine-1" running={running} />
          </I18nProvider>
        </MemoryRouter>,
      ),
    );
  await render(true);
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  await act(async () => button("Run history").click());
  await act(async () => button("Load older runs").click());
  expect(container.querySelectorAll("li")).toHaveLength(3);
  await render(false);
  expect(container.querySelectorAll("li")).toHaveLength(3);
  await act(async () => root.unmount());
  container.remove();
});

it("refreshes the first page when a run finishes while expanded and keeps older pages", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const older = { ...run, id: "older", messageId: "older-reply" };
  const oldest = { ...run, id: "oldest", messageId: "oldest-reply" };
  const cursor = { id: "run-1", createdAt: run.createdAt };
  const newRun = {
    ...run,
    id: "run-new",
    messageId: "new-reply",
    createdAt: "2026-01-03T12:00:00Z",
  };
  api.history
    .mockResolvedValueOnce({ runs: [run, older], nextCursor: cursor })
    .mockResolvedValueOnce({ runs: [oldest], nextCursor: null })
    .mockResolvedValueOnce({ runs: [newRun, run, older], nextCursor: cursor });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (running: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <I18nProvider i18n={i18n}>
            <RoutineRunHistory routineId="routine-1" running={running} />
          </I18nProvider>
        </MemoryRouter>,
      ),
    );
  await render(true);
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    await act(async () => button("Load older runs").click());
    expect(container.querySelectorAll("[data-testid='routine-run-row']")).toHaveLength(3);
    await render(false);
    const rows = [...container.querySelectorAll("[data-testid='routine-run-row']")];
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.querySelector("a")?.getAttribute("href"))).toEqual([
      "/app/bot-1?m=new-reply",
      "/app/bot-1?m=reply-1",
      "/app/bot-1?m=older-reply",
      "/app/bot-1?m=oldest-reply",
    ]);
    expect(button("Load older runs")).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("shows the routine name on each run row", async () => {
  api.history.mockResolvedValue(page([run]));
  const view = await mounted("routine-1", "Monday cash check");
  try {
    expect(view.container.querySelector("li")?.textContent).toContain("Monday cash check");
  } finally {
    await view.close();
  }
});

it("shows a finished run that only asked another agent as waiting on that agent", async () => {
  api.history.mockResolvedValue(page([{ ...run, waitingOn: "Inbox agent" }]));
  const view = await mounted();
  const row = view.container.querySelector('[data-testid="routine-run-row"]');
  expect(row?.textContent).toContain("Waiting on Inbox agent");
  expect(row?.textContent).not.toContain("Done");
  await view.close();
});

it("shows why a silent run failed, with the raw error behind Details when it was reworded", async () => {
  const error = "401: invalid key";
  api.history.mockResolvedValue(page([{ ...run, status: "failed", messageId: null, error }]));
  const view = await mounted();
  try {
    expect(view.container.textContent).toContain(
      "The model provider did not accept your API key. Check it in Settings > Models.",
    );
    const details = view.container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe("Details");
    expect(details?.querySelector("pre")?.textContent).toBe(error);
  } finally {
    await view.close();
  }
});

it("shows a plain failure reason once, without a Details toggle", async () => {
  const error = "504: request timed out";
  api.history.mockResolvedValue(page([{ ...run, status: "failed", messageId: null, error }]));
  const view = await mounted();
  try {
    expect(view.container.textContent).toContain(error);
    expect(view.container.querySelector("details")).toBeNull();
  } finally {
    await view.close();
  }
});

it.each(["completed", "failed"] as const)(
  "shows no failure reason for a %s run without an error",
  async (status) => {
    api.history.mockResolvedValue(page([{ ...run, status, messageId: null }]));
    const view = await mounted();
    try {
      expect(view.container.querySelector("details")).toBeNull();
    } finally {
      await view.close();
    }
  },
);

it("omits the failure reason of a completed run carrying a stale error", async () => {
  api.history.mockResolvedValue(page([{ ...run, error: "504: request timed out" }]));
  const view = await mounted();
  try {
    expect(view.container.textContent).not.toContain("504: request timed out");
  } finally {
    await view.close();
  }
});

it("offers the settings fix only on the newest failed run", async () => {
  const failed: RoutineRun = {
    ...run,
    status: "failed",
    error: "401: invalid key",
    messageId: null,
  };
  const older = { ...failed, id: "older" };
  api.history.mockResolvedValue({ runs: [failed, older], nextCursor: null });
  const onOpenModelSettings = vi.fn();
  const view = await mounted("routine-1", undefined, { onOpenModelSettings });
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  try {
    await act(async () => button("Run history").click());
    const fixes = [...view.container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Open Models settings",
    );
    expect(fixes).toHaveLength(1);
    const rows = [...view.container.querySelectorAll("[data-testid='routine-run-row']")];
    expect(rows[0]?.textContent).toContain("Open Models settings");
    expect(rows[1]?.textContent).not.toContain("Open Models settings");
    await act(async () => fixes[0]?.click());
    expect(onOpenModelSettings).toHaveBeenCalledOnce();
  } finally {
    await view.close();
  }
});

it("offers sign-in and choose-connection for a lost pinned connection", async () => {
  api.history.mockResolvedValue(
    page([{ ...run, status: "failed", error: PINNED_CONNECTION_LOST_MESSAGE, messageId: null }]),
  );
  const onOpenModelSettings = vi.fn();
  const onOpenBotSettings = vi.fn();
  const view = await mounted("routine-1", undefined, {
    onOpenModelSettings,
    onOpenBotSettings,
  });
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name);
  try {
    await act(async () => button("Sign in again")?.click());
    expect(onOpenModelSettings).toHaveBeenCalledOnce();
    await act(async () => button("Choose another connection")?.click());
    expect(onOpenBotSettings).toHaveBeenCalledOnce();
  } finally {
    await view.close();
  }
});

it("shows only sign-in for a lost connection when the bot settings are not offered", async () => {
  api.history.mockResolvedValue(
    page([{ ...run, status: "failed", error: PINNED_CONNECTION_LOST_MESSAGE, messageId: null }]),
  );
  const view = await mounted("routine-1", undefined, { onOpenModelSettings: vi.fn() });
  try {
    expect(view.container.textContent).toContain("Sign in again");
    expect(view.container.textContent).not.toContain("Choose another connection");
  } finally {
    await view.close();
  }
});

it("shows no fix buttons when the failure only says to try again", async () => {
  api.history.mockResolvedValue(
    page([{ ...run, status: "failed", error: "429: too many requests", messageId: null }]),
  );
  const view = await mounted("routine-1", undefined, {
    onOpenModelSettings: vi.fn(),
    onOpenBotSettings: vi.fn(),
  });
  try {
    expect(view.container.textContent).not.toContain("Open Models settings");
    expect(view.container.textContent).not.toContain("Sign in again");
    expect(view.container.textContent).not.toContain("Choose another connection");
  } finally {
    await view.close();
  }
});

it("keeps a run-state refresh when the slower first load answers after it", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let finishFirst!: (rows: RoutineRun[]) => void;
  const newer = { ...run, id: "run-new", messageId: "new-reply", preview: "Fresh run." };
  api.history
    .mockReturnValueOnce(
      new Promise<RoutineRun[]>((resolve) => {
        finishFirst = resolve;
      }).then(page),
    )
    .mockResolvedValueOnce(page([newer, run]));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (running: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <I18nProvider i18n={i18n}>
            <RoutineRunHistory routineId="routine-1" running={running} />
          </I18nProvider>
        </MemoryRouter>,
      ),
    );
  try {
    await render(true);
    await render(false);
    expect(container.textContent).toContain("Fresh run.");
    await act(async () => finishFirst([run]));
    expect(container.textContent).toContain("Fresh run.");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
