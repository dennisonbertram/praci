// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  scratchpad: { list: vi.fn(), remove: vi.fn(), update: vi.fn() },
  toasts: [] as { title: string; action?: { label: string; onClick: () => void } }[],
}));
vi.mock("../lib/rpc", () => ({ rpc: api }));
vi.mock("@rakazo/ui-web", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/ui-web")>()),
  enqueueNotificationToast: (input: {
    title: string;
    action?: { label: string; onClick: () => void };
  }) => {
    api.toasts.push(input);
    return "toast";
  },
}));
const join = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      String.raw(parts, ...values),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: join, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { resetHeldRemovals } from "../lib/scratchpad-removals";
import { ScratchpadSection } from "./ScratchpadSection";

const item = (id: string, title: string) => ({
  id,
  title,
  status: "open",
  dueAt: null,
  waitingOn: null,
});

it("reloads the list when refreshKey changes, so items added in chat appear", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.scratchpad.list.mockResolvedValueOnce([]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<ScratchpadSection botId="bot_1" refreshKey={0} />));
  expect(container.textContent).not.toContain("Call Acme");

  api.scratchpad.list.mockResolvedValueOnce([item("i1", "Call Acme")]);
  await act(async () => root.render(<ScratchpadSection botId="bot_1" refreshKey={1} />));
  expect(api.scratchpad.list).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("Call Acme");
});

it("shows a retry action after the first load fails, then renders the items", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.scratchpad.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(twoRows());
  const page = await show();
  try {
    expect(page.container.textContent).toContain("Could not load");
    expect(page.container.textContent).not.toContain("None yet");
    const retry = [...page.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeDefined();
    await act(async () => retry?.click());
    expect(page.container.textContent).toContain("Call Acme");
  } finally {
    act(() => page.root.unmount());
  }
});

it("keeps loaded rows when a focus refresh fails", async () => {
  let requests = 0;
  api.scratchpad.list.mockImplementation(() => {
    requests += 1;
    return requests === 1 ? Promise.resolve(twoRows()) : Promise.reject(new Error("offline"));
  });
  const page = await show();
  try {
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(page.container.textContent).toContain("Call Acme");
    expect(page.container.textContent).toContain("Sign the NDA");
    expect(page.container.textContent).not.toContain("Could not load");
  } finally {
    act(() => page.root.unmount());
  }
});

it("scrolls to the focused item once the list has it, and nothing else", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scrolled: string[] = [];
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrolled.push((this as HTMLElement).dataset.scratchpadItem ?? "?");
  };
  api.scratchpad.list.mockResolvedValue([
    { ...item("s1", "Call Acme"), status: "open" },
    { ...item("s2", "Sign the NDA"), status: "open" },
  ]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ScratchpadSection botId="bot_1" focusItemId="s2" />));
    expect(scrolled).toEqual(["s2"]);
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
    act(() => root.unmount());
    container.remove();
  }
});

it("puts past-due work first and names only parked rows", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
  api.scratchpad.list.mockResolvedValue([
    { ...item("fresh", "Fresh task"), status: "open" },
    { ...item("parked", "Set aside task"), status: "parked" },
    { ...item("late", "Late task"), status: "open", dueAt: past },
  ]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ScratchpadSection botId="bot_1" />));
    const rows = [...container.querySelectorAll<HTMLElement>("[data-scratchpad-item]")];
    expect(rows.map((row) => row.dataset.scratchpadItem)).toEqual(["late", "fresh", "parked"]);
    for (const row of rows) expect(row.textContent).not.toMatch(/\bopen\b/);
    expect(rows[2]?.textContent).toContain("Parked");
    expect(rows[0]?.textContent).not.toContain("Parked");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it("reports a focused row as handled once", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const onFocusHandled = vi.fn();
  api.scratchpad.list.mockResolvedValue([{ ...item("s2", "Sign the NDA"), status: "open" }]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <ScratchpadSection botId="bot_1" focusItemId="s2" onFocusHandled={onFocusHandled} />,
      ),
    );
    expect(onFocusHandled).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it("shows a status server error and reloads the list after the update fails", async () => {
  api.scratchpad.list.mockResolvedValue(twoRows());
  api.scratchpad.update.mockRejectedValue(new Error("Changed, review again"));
  const page = await show();
  try {
    await act(async () => page.button("s1", "Park")?.click());
    expect(page.container.textContent).toContain("Changed, review again");
    expect(api.scratchpad.list).toHaveBeenCalledTimes(2);
  } finally {
    act(() => page.root.unmount());
  }
});

it("shows offline copy instead of network details when a status update fails", async () => {
  api.scratchpad.list.mockResolvedValue(twoRows());
  api.scratchpad.update.mockRejectedValue(new TypeError("Failed to fetch"));
  const page = await show();
  try {
    await act(async () => page.button("s1", "Park")?.click());
    expect(page.container.textContent).toContain("Could not reach the server");
    expect(page.container.textContent).not.toContain("Failed to fetch");
  } finally {
    act(() => page.root.unmount());
  }
});

/** Runs `body` with fake timers, so the Undo window can be crossed without waiting. */
const withClock = async (body: () => Promise<void>) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await body();
  } finally {
    vi.useRealTimers();
  }
};
const passUndoWindow = () => act(async () => vi.advanceTimersByTimeAsync(5_001));

const twoRows = () => [
  { ...item("s1", "Call Acme"), status: "open" },
  { ...item("s2", "Sign the NDA"), status: "open" },
];

async function show(botId = "bot_1") {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async (props: { refreshKey?: number; focusItemId?: string } = {}) =>
    act(async () => root.render(<ScratchpadSection botId={botId} {...props} />));
  await render();
  await act(async () => Promise.resolve());
  return {
    container,
    root,
    render,
    row: (id: string) => container.querySelector<HTMLElement>(`[data-scratchpad-item="${id}"]`),
    button: (id: string, name: string) =>
      [
        ...(container.querySelector(`[data-scratchpad-item="${id}"]`)?.querySelectorAll("button") ??
          []),
      ].find((button) => button.getAttribute("aria-label") === name),
  };
}

beforeEach(() => {
  api.toasts.length = 0;
  api.scratchpad.list.mockReset();
  api.scratchpad.remove.mockReset();
  api.scratchpad.update.mockReset();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  resetHeldRemovals();
  document.body.replaceChildren();
});

it("holds the remove for the Undo window, then deletes once", () =>
  withClock(async () => {
    api.scratchpad.list.mockResolvedValue(twoRows());
    api.scratchpad.remove.mockResolvedValue({ ok: true });
    const page = await show();
    try {
      await act(async () => page.button("s1", "Remove")?.click());
      expect(page.row("s1")).toBeNull();
      expect(page.row("s2")).not.toBeNull();
      expect(api.toasts.map((toast) => toast.title)).toEqual(["Removed Call Acme"]);
      expect(api.scratchpad.remove).not.toHaveBeenCalled();
      await passUndoWindow();
      expect(api.scratchpad.remove).toHaveBeenCalledTimes(1);
      expect(api.scratchpad.remove).toHaveBeenCalledWith({ itemId: "s1" });
    } finally {
      act(() => page.root.unmount());
    }
  }));

it("Undo inside the window brings the same row back and never deletes", () =>
  withClock(async () => {
    api.scratchpad.list.mockResolvedValue(twoRows());
    api.scratchpad.remove.mockResolvedValue({ ok: true });
    const page = await show();
    try {
      await act(async () => page.button("s1", "Remove")?.click());
      const undo = api.toasts.at(-1)?.action;
      expect(undo?.label).toBe("Undo");
      await act(async () => undo?.onClick());
      expect(page.row("s1")).not.toBeNull();
      const ids = [...page.container.querySelectorAll<HTMLElement>("[data-scratchpad-item]")].map(
        (row) => row.dataset.scratchpadItem,
      );
      expect(ids).toEqual(["s1", "s2"]);
      expect(api.toasts).toHaveLength(1);
      await passUndoWindow();
      expect(api.scratchpad.remove).not.toHaveBeenCalled();
    } finally {
      act(() => page.root.unmount());
    }
  }));

it("keeps a held row hidden when the list reloads, and still deletes once", () =>
  withClock(async () => {
    api.scratchpad.list.mockResolvedValue(twoRows());
    api.scratchpad.remove.mockResolvedValue({ ok: true });
    const page = await show();
    try {
      await act(async () => page.button("s1", "Remove")?.click());
      await page.render({ refreshKey: 1 });
      expect(api.scratchpad.list).toHaveBeenCalledTimes(2);
      expect(page.row("s1")).toBeNull();
      await act(async () => page.root.unmount());
      const again = createRoot(document.createElement("div"));
      act(() => again.unmount());
      await passUndoWindow();
      expect(api.scratchpad.remove).toHaveBeenCalledTimes(1);
    } finally {
      act(() => page.root.unmount());
    }
  }));

it("puts the row back and shows the server message when the remove fails", () =>
  withClock(async () => {
    api.scratchpad.list.mockResolvedValue(twoRows());
    api.scratchpad.remove.mockRejectedValue(new Error("Scratchpad item changed; retry."));
    const page = await show();
    try {
      await act(async () => page.button("s1", "Remove")?.click());
      await passUndoWindow();
      expect(page.row("s1")).not.toBeNull();
      expect(api.toasts.map((toast) => toast.title)).toContain("Scratchpad item changed; retry.");
    } finally {
      act(() => page.root.unmount());
    }
  }));

it("still deletes when the section unmounts inside the window", () =>
  withClock(async () => {
    api.scratchpad.list.mockResolvedValue(twoRows());
    api.scratchpad.remove.mockResolvedValue({ ok: true });
    const page = await show();
    await act(async () => page.button("s1", "Remove")?.click());
    act(() => page.root.unmount());
    await passUndoWindow();
    expect(api.scratchpad.remove).toHaveBeenCalledTimes(1);
    expect(api.scratchpad.remove).toHaveBeenCalledWith({ itemId: "s1" });
  }));

it("leaves the other rows usable while one remove is held", () =>
  withClock(async () => {
    api.scratchpad.list.mockResolvedValue(twoRows());
    api.scratchpad.remove.mockResolvedValue({ ok: true });
    const page = await show();
    try {
      await act(async () => page.button("s1", "Remove")?.click());
      expect(page.button("s2", "Remove")?.disabled).toBe(false);
      expect(page.button("s2", "Park")?.disabled).toBe(false);
      await act(async () => page.button("s2", "Remove")?.click());
      expect(api.toasts.map((toast) => toast.title)).toEqual([
        "Removed Call Acme",
        "Removed Sign the NDA",
      ]);
      await passUndoWindow();
      expect(api.scratchpad.remove).toHaveBeenCalledTimes(2);
    } finally {
      act(() => page.root.unmount());
    }
  }));
