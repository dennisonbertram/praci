// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ORPCError } from "@orpc/client";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  meetings: { get: vi.fn(), mergeWithPrevious: vi.fn() },
  inbox: { todos: { setDone: vi.fn() } },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

import { RETURN_DEDUPE_MS } from "../lib/use-refetch-while-open";
import { MeetingDetailPage } from "./MeetingDetail";
import { detail } from "./meetings-fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("shows 3 decisions on a phone and the rest after See all", async () => {
  const decisions = [1, 2, 3, 4, 5].map((n) => `Decision number ${n}`);
  rpcMock.meetings.get.mockResolvedValue({ ...detail, decisions, followUps: [], todos: [] });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <MeetingDetailPage meetingId="m2" />
        </MemoryRouter>
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  const shown = () => (container.textContent?.match(/Decision number/g) ?? []).length;
  expect(shown()).toBe(3);
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "See all (5)",
  );
  await act(async () => button?.click());
  expect(shown()).toBe(5);
});

it("keeps the line breaks in the summary", async () => {
  rpcMock.meetings.get.mockResolvedValue({ ...detail, summary: "Decided.\n\n- Send the letter" });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <MeetingDetailPage meetingId="m2" />
        </MemoryRouter>
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  const p = [...container.querySelectorAll("p")].find((e) => e.textContent?.startsWith("Decided."));
  expect(p?.className).toContain("whitespace-pre-wrap");
});

const mount = async (meetingId = "m2") => {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <MeetingDetailPage meetingId={meetingId} />
        </MemoryRouter>
      </I18nProvider>,
    ),
  );
  await act(async () => {});
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

it("shows Summarizing and polls while the server says a digest is coming", async () => {
  vi.useFakeTimers();
  const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    rpcMock.meetings.get.mockResolvedValue({
      ...detail,
      provider: "granola",
      summary: "",
      decisions: [],
      followUps: [],
      todos: [],
      summarizing: true,
    });
    await mount();
    expect(container.textContent).toContain("Summarizing…");
    const calls = rpcMock.meetings.get.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(rpcMock.meetings.get).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(rpcMock.meetings.get.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    if (visibility) Object.defineProperty(document, "visibilityState", visibility);
    else Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
  }
});

it("does not guess Summarizing for a fresh Praci recording the server is not summarizing", async () => {
  rpcMock.meetings.get.mockResolvedValue({
    ...detail,
    provider: "praci",
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    endedAt: new Date(Date.now() - 60_000).toISOString(),
    summary: "",
    decisions: [],
    followUps: [],
    todos: [],
    summarizing: false,
  });
  await mount();
  expect(container.textContent).not.toContain("Summarizing…");
});

it("lists other people's action items as text under Action items, and hides it when empty", async () => {
  rpcMock.meetings.get.mockResolvedValue({
    ...detail,
    actionItems: [
      { owner: "Bea", text: "Book the <b>room</b>", due: "2026-11-20" },
      { owner: "Cy", text: "Send the notes", due: null },
    ],
  });
  await mount();
  expect(container.textContent).toContain("Action items");
  expect(container.textContent).toContain("Bea: Book the <b>room</b>");
  expect(container.querySelector("li b")).toBeNull();
  expect(container.textContent).toContain("Cy: Send the notes");
  // After the user's own to-dos.
  expect(container.textContent!.indexOf("Action items")).toBeGreaterThan(
    container.textContent!.indexOf("Your to-dos"),
  );
  await act(async () => root.render(<div />));
  rpcMock.meetings.get.mockResolvedValue({ ...detail, actionItems: [] });
  await mount();
  expect(container.textContent).not.toContain("Action items");
});

it("keeps the date, length and source line visible on a phone", async () => {
  rpcMock.meetings.get.mockResolvedValue(detail);
  await mount();
  const header = container.querySelector("[data-page-header]");
  expect(header?.textContent).toContain("24 min");
  expect(header?.className).not.toContain("hidden");
});

it("shows a summary that arrived elsewhere when the window regains focus", async () => {
  rpcMock.meetings.get
    .mockResolvedValueOnce({ ...detail, summary: "Original summary" })
    .mockResolvedValueOnce({ ...detail, summary: "Summary added elsewhere" });
  await mount();
  expect(container.textContent).toContain("Original summary");
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(rpcMock.meetings.get).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("Summary added elsewhere");
});

it("keeps the meeting on screen when a refresh fails", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.meetings.get
      .mockResolvedValueOnce({ ...detail, summary: "Existing meeting summary", summarizing: true })
      .mockRejectedValueOnce(new Error("offline"));
    await mount();
    expect(container.textContent).toContain("Existing meeting summary");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("Existing meeting summary");
  } finally {
    vi.useRealTimers();
  }
});

it("shows the not-found error when a meeting is deleted elsewhere", async () => {
  rpcMock.meetings.get
    .mockResolvedValueOnce({ ...detail, title: "Deleted meeting" })
    .mockRejectedValueOnce(new ORPCError("NOT_FOUND", { message: "Meeting not found" }));
  await mount();
  expect(container.textContent).toContain("Deleted meeting");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Meeting not found");
  expect(
    [...container.querySelectorAll("button")].some((button) => button.textContent === "Try again"),
  ).toBe(true);
  expect(container.textContent).not.toContain("Deleted meeting");
});

it("keeps a failed to-do error when a refresh succeeds", async () => {
  rpcMock.meetings.get.mockResolvedValue({ ...detail, summarizing: false });
  rpcMock.inbox.todos.setDone.mockRejectedValueOnce(new Error("Could not save"));
  await mount();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  const box = container.querySelector<HTMLElement>('[role="checkbox"]');
  expect(box).not.toBeNull();
  await act(async () => box?.click());
  await act(async () => {});
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => window.dispatchEvent(new Event("focus")));
  await act(async () => {});
  // The refresh succeeded, but the to-do still did not change: the failure stays on screen.
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("keeps a saved to-do checked when an older load resolves afterward", async () => {
  const oldLoad = deferred<typeof detail>();
  rpcMock.meetings.get.mockResolvedValueOnce(detail).mockReturnValueOnce(oldLoad.promise);
  rpcMock.inbox.todos.setDone.mockResolvedValueOnce({
    ...detail.todos[0]!,
    doneAt: "2026-11-10T12:00:00.000Z",
  });
  await mount();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => window.dispatchEvent(new Event("focus")));
  const box = container.querySelector<HTMLElement>('[role="checkbox"]');
  await act(async () => box?.click());
  expect(box?.getAttribute("aria-checked")).toBe("true");
  await act(async () => oldLoad.resolve({ ...detail, summary: "Stale summary" }));
  expect(container.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
  expect(container.textContent).not.toContain("Stale summary");
});

it("keeps the newer summary when an older overlapping load resolves last", async () => {
  const olderLoad = deferred<typeof detail>();
  const newerLoad = deferred<typeof detail>();
  rpcMock.meetings.get
    .mockResolvedValueOnce({ ...detail, summary: "Initial summary" })
    .mockReturnValueOnce(olderLoad.promise)
    .mockReturnValueOnce(newerLoad.promise);
  await mount();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => window.dispatchEvent(new Event("focus")));
  // A return inside the dedupe window would count as the same return, so make this a later one.
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + RETURN_DEDUPE_MS + 1);
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  now.mockRestore();
  await act(async () => newerLoad.resolve({ ...detail, summary: "Newer summary" }));
  expect(container.textContent).toContain("Newer summary");
  await act(async () => olderLoad.resolve({ ...detail, summary: "Older summary" }));
  expect(container.textContent).toContain("Newer summary");
  expect(container.textContent).not.toContain("Older summary");
});

it("sends only one save when the same to-do is clicked while its save is pending", async () => {
  rpcMock.meetings.get.mockResolvedValue(detail);
  rpcMock.inbox.todos.setDone.mockReturnValue(new Promise(() => {}));
  await mount();
  const box = container.querySelector<HTMLElement>('[role="checkbox"]');
  await act(async () => {
    box?.click();
    box?.click();
  });
  expect(rpcMock.inbox.todos.setDone).toHaveBeenCalledTimes(1);
});

it("hides Try again for a failed save and clears the alert on the next toggle", async () => {
  rpcMock.meetings.get.mockResolvedValue(detail);
  rpcMock.inbox.todos.setDone
    .mockRejectedValueOnce(new Error("Could not save"))
    .mockResolvedValueOnce({ ...detail.todos[0]!, doneAt: "2026-11-10T12:00:00.000Z" });
  await mount();
  const box = container.querySelector<HTMLElement>('[role="checkbox"]');
  await act(async () => box?.click());
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(
    [...container.querySelectorAll("button")].some((button) => button.textContent === "Try again"),
  ).toBe(false);
  await act(async () => box?.click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("ignores a failed to-do save after switching meetings", async () => {
  const pendingSave = deferred<(typeof detail.todos)[number]>();
  rpcMock.meetings.get.mockResolvedValue(detail);
  rpcMock.inbox.todos.setDone.mockReturnValueOnce(pendingSave.promise);
  await mount("m1");
  const box = container.querySelector<HTMLElement>('[role="checkbox"]');
  await act(async () => box?.click());
  await mount("m2");
  await act(async () => pendingSave.reject(new Error("Could not save")));
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("shows Try again for a load error after an earlier save error", async () => {
  rpcMock.meetings.get.mockResolvedValueOnce(detail).mockRejectedValueOnce(new Error("offline"));
  rpcMock.inbox.todos.setDone.mockRejectedValueOnce(new Error("Could not save"));
  await mount("m1");
  const box = container.querySelector<HTMLElement>('[role="checkbox"]');
  await act(async () => box?.click());
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await mount("m2");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(
    [...container.querySelectorAll("button")].some((button) => button.textContent === "Try again"),
  ).toBe(true);
});

it("offers Merge with previous only when the meeting can merge", async () => {
  rpcMock.meetings.get.mockResolvedValue({ ...detail, canMergeWithPrevious: false });
  await mount();
  expect(container.querySelector('button[aria-label="More"]')).toBeNull();
  await act(async () => root.render(<div />));
  rpcMock.meetings.get.mockResolvedValue({ ...detail, canMergeWithPrevious: true });
  await mount();
  const more = container.querySelector<HTMLButtonElement>('button[aria-label="More"]');
  expect(more).not.toBeNull();
  await act(async () => more?.click());
  const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
    el.textContent?.includes("Merge with previous"),
  );
  expect(item).toBeDefined();
  rpcMock.meetings.mergeWithPrevious.mockResolvedValue({ meetingId: "m1" });
  await act(async () => (item as HTMLElement).click());
  expect(rpcMock.meetings.mergeWithPrevious).toHaveBeenCalledWith({ meetingId: "m2" });
});
