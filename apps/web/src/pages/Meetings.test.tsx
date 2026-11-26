// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const tag = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: tag }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: tag }));

const rpc = vi.hoisted(() => ({
  meetings: { list: vi.fn(), get: vi.fn(), delete: vi.fn() },
  inbox: { todos: { setDone: vi.fn() } },
}));
vi.mock("../lib/rpc", () => ({ rpc }));

import { MeetingDetailPage } from "./MeetingDetail";
import { MeetingsPage } from "./Meetings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (id: string, title: string, provider: string) => ({
  id,
  title,
  provider,
  startedAt: "2026-10-19T10:00:00.000Z",
  endedAt: "2026-10-19T10:30:00.000Z",
});
const rows = [row("m1", "Weekly sync", "granola"), row("m2", "Zoom call", "hex")];
const roots: ReturnType<typeof createRoot>[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
});

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => {
      root.unmount();
    });
  });
});

async function mount(node: ReactNode, url = "/app/meetings") {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>));
  return container;
}

it("retries the list, not the whole app, from the slow-loading Try again", async () => {
  vi.useFakeTimers();
  try {
    rpc.meetings.list.mockReturnValueOnce(new Promise(() => {}));
    rpc.meetings.list.mockResolvedValue({ items: rows, nextCursor: null });
    const page = await mount(<MeetingsPage />);
    await act(async () => void vi.advanceTimersByTime(20_000));
    const retry = [...page.querySelectorAll("button")].find((b) => b.textContent === "Try again");
    await act(async () => retry?.click());
    expect(rpc.meetings.list).toHaveBeenCalledTimes(2);
    expect(page.textContent).toContain("Weekly sync");
  } finally {
    vi.useRealTimers();
  }
});

it("lists every source with its duration", async () => {
  rpc.meetings.list.mockResolvedValue({ items: rows, nextCursor: null });
  const all = await mount(<MeetingsPage />);
  expect(all.textContent).toContain("Weekly sync");
  expect(all.textContent).toContain("Zoom call");
  expect(all.textContent).toContain("30 min");
  expect(rpc.meetings.list).toHaveBeenCalledWith({});
});

it("shows a meeting stored elsewhere when the window regains focus", async () => {
  const elsewhere = row("m3", "Stored elsewhere", "hex");
  rpc.meetings.list
    .mockResolvedValueOnce({ items: rows, nextCursor: null })
    .mockResolvedValueOnce({ items: [...rows, elsewhere], nextCursor: null });
  const page = await mount(<MeetingsPage />);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

  await act(async () => window.dispatchEvent(new Event("focus")));

  expect(rpc.meetings.list).toHaveBeenCalledTimes(2);
  expect(page.textContent).toContain("Stored elsewhere");
});

it("keeps the list when a background refresh fails", async () => {
  rpc.meetings.list
    .mockResolvedValueOnce({ items: rows, nextCursor: null })
    .mockRejectedValueOnce(new Error("offline"));
  const page = await mount(<MeetingsPage />);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

  await act(async () => window.dispatchEvent(new Event("focus")));

  expect(rpc.meetings.list).toHaveBeenCalledTimes(2);
  expect(page.textContent).toContain("Weekly sync");
  expect(page.textContent).toContain("Zoom call");
  expect(page.querySelector('[role="alert"]')).toBeNull();
});

it("asks the server for the source and search in the URL", async () => {
  rpc.meetings.list.mockResolvedValue({ items: [rows[1]!], nextCursor: null });
  const page = await mount(<MeetingsPage />, "/app/meetings?source=hex&q=zoom");
  expect(rpc.meetings.list).toHaveBeenCalledWith({ q: "zoom", provider: "hex" });
  expect(page.textContent).toContain("Zoom call");
});

it("asks the server for the attendee in the URL", async () => {
  rpc.meetings.list.mockResolvedValue({ items: [rows[0]!], nextCursor: null });
  const page = await mount(<MeetingsPage />, "/app/meetings?attendee=ada%40example.test");
  expect(rpc.meetings.list).toHaveBeenCalledWith({ attendee: "ada@example.test" });
  expect(page.textContent).toContain("Person: ada@example.test");
});

it("clears the attendee filter and asks again", async () => {
  rpc.meetings.list.mockResolvedValue({ items: rows, nextCursor: null });
  const page = await mount(<MeetingsPage />, "/app/meetings?attendee=ada%40example.test");
  const clear = [...page.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === "Remove filter Person",
  );
  expect(clear).toBeDefined();
  await act(async () => clear?.click());
  expect(rpc.meetings.list).toHaveBeenLastCalledWith({});
  expect(page.textContent).not.toContain("Person:");
});

it("shows the filters, not No meetings, when an attendee matches nothing", async () => {
  rpc.meetings.list.mockResolvedValue({ items: [], nextCursor: null });
  const page = await mount(<MeetingsPage />, "/app/meetings?attendee=ada%40example.test");
  expect(page.textContent).toContain("No matches");
  expect(page.textContent).not.toContain("No meetings");
  const clear = [...page.querySelectorAll("button")].find((b) => b.textContent === "Clear filters");
  await act(async () => clear?.click());
  expect(rpc.meetings.list).toHaveBeenLastCalledWith({});
});

it("keeps the search box when a filter matches nothing", async () => {
  rpc.meetings.list.mockResolvedValue({ items: [], nextCursor: null });
  const page = await mount(<MeetingsPage />, "/app/meetings?q=zzz");
  expect(page.querySelector("input[type=search]")).not.toBeNull();
  expect(page.textContent).toContain("No matches");
});

it("says No meetings when there are none", async () => {
  rpc.meetings.list.mockResolvedValue({ items: [], nextCursor: null });
  const page = await mount(<MeetingsPage />);
  expect(page.textContent).toContain("No meetings");
  expect(page.querySelector("table")).toBeNull();
});

it("shows a meeting's digest and to-dos with the transcript collapsed", async () => {
  rpc.meetings.get.mockResolvedValue({
    ...rows[1],
    summary: "",
    decisions: ["Ship on Friday"],
    followUps: ["Who books the room?"],
    todos: [{ id: "t1", text: "Send the deck", dueOn: null, doneAt: null }],
    transcript: "Ada: hello there",
    summarizing: false,
    actionItems: [],
  });
  const page = await mount(<MeetingDetailPage meetingId="m2" />, "/app/meetings/m2");
  expect(page.textContent).toContain("Ship on Friday");
  expect(page.textContent).toContain("Who books the room?");
  expect(page.textContent).toContain("Send the deck");
  expect(rpc.meetings.get).toHaveBeenCalledWith({ meetingId: "m2" });
  const transcript = page.querySelector("details");
  expect(transcript?.open).toBe(false);
  expect(transcript?.textContent).toContain("Transcript");
});

it("shows the meeting the page is on when an earlier one answers last", async () => {
  const full = (id: string, title: string) => ({
    ...row(id, title, "hex"),
    summary: "",
    decisions: [],
    followUps: [],
    todos: [],
    transcript: null,
    summarizing: false,
    actionItems: [],
  });
  let answerA: (value: unknown) => void = () => {};
  rpc.meetings.get.mockImplementation(({ meetingId }: { meetingId: string }) =>
    meetingId === "a"
      ? new Promise((resolve) => (answerA = resolve))
      : Promise.resolve(full("b", "Meeting B")),
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const show = (id: string) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <MeetingDetailPage meetingId={id} />
        </MemoryRouter>,
      ),
    );
  await show("a");
  await show("b");
  await act(async () => answerA(full("a", "Meeting A")));
  expect(container.textContent).toContain("Meeting B");
  expect(container.textContent).not.toContain("Meeting A");
});

it("says part of a recording could not be transcribed", async () => {
  const full = {
    ...rows[1],
    provider: "praci",
    summary: "",
    decisions: ["Ship on Friday"],
    followUps: [],
    todos: [],
    transcript: "Ada: hello",
    summarizing: false,
    actionItems: [],
  };
  rpc.meetings.get.mockResolvedValue({ ...full, partial: true });
  const partial = await mount(<MeetingDetailPage meetingId="m2" />, "/app/meetings/m2");
  expect(partial.textContent).toContain("Part of this meeting could not be transcribed.");
  rpc.meetings.get.mockResolvedValue({ ...full, partial: false });
  const whole = await mount(<MeetingDetailPage meetingId="m2" />, "/app/meetings/m2");
  expect(whole.textContent).not.toContain("could not be transcribed");
});

it("shows Summarizing while a fresh recording has only its transcript", async () => {
  rpc.meetings.get.mockResolvedValue({
    ...rows[1],
    provider: "praci",
    endedAt: new Date().toISOString(),
    summary: "",
    decisions: [],
    followUps: [],
    todos: [],
    transcript: "Ada: hello",
    partial: false,
    summarizing: true,
    actionItems: [],
  });
  const page = await mount(<MeetingDetailPage meetingId="m2" />, "/app/meetings/m2");
  expect(page.textContent).toContain("Summarizing…");
});

it("keeps asking for the summary every 5 seconds while it is pending", async () => {
  vi.useFakeTimers();
  try {
    rpc.meetings.get.mockResolvedValue({
      ...rows[1],
      provider: "praci",
      endedAt: new Date().toISOString(),
      summary: "",
      decisions: [],
      followUps: [],
      todos: [],
      transcript: "Ada: hello",
      partial: false,
      summarizing: true,
      actionItems: [],
    });
    await mount(<MeetingDetailPage meetingId="m2" />, "/app/meetings/m2");
    expect(rpc.meetings.get).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(rpc.meetings.get.mock.calls.length).toBeGreaterThanOrEqual(3);
  } finally {
    vi.useRealTimers();
  }
});

it("names the Omi cloud source in the list and offers it as a filter", async () => {
  rpc.meetings.list.mockResolvedValue({
    items: [row("m3", "Cloud call", "omi_cloud")],
    nextCursor: null,
  });
  const page = await mount(<MeetingsPage />);
  expect(page.textContent).toContain("Omi cloud");
  expect(page.textContent).not.toContain("omi_cloud");
  const { MEETING_SOURCES, meetingSourceName } = await import("../lib/meeting-source");
  expect(MEETING_SOURCES).toContain("omi_cloud");
  expect(meetingSourceName("omi_cloud")).toBe("Omi cloud");
  expect(MEETING_SOURCES).toContain("wisprflow");
  expect(meetingSourceName("wisprflow")).toBe("Wispr Flow");
});

it("says so when Show more fails", async () => {
  rpc.meetings.list
    .mockResolvedValueOnce({ items: rows, nextCursor: "c2" })
    .mockRejectedValueOnce(new Error("offline"));
  const page = await mount(<MeetingsPage />);
  const more = [...page.querySelectorAll("button")].find((b) => b.textContent === "Show more");
  await act(async () => more?.click());
  await act(async () => {});
  expect(page.textContent).toContain("offline");
});

it("does not let a refresh still on its way erase Show more", async () => {
  let finishRefresh: (value: { items: typeof rows; nextCursor: string | null }) => void = () => {};
  rpc.meetings.list
    .mockResolvedValueOnce({ items: [rows[0]!], nextCursor: "c2" })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    )
    .mockResolvedValueOnce({ items: [rows[1]!], nextCursor: null });
  const page = await mount(<MeetingsPage />);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => window.dispatchEvent(new Event("focus")));
  const more = [...page.querySelectorAll("button")].find((b) => b.textContent === "Show more");
  await act(async () => more?.click());
  await act(async () => {});
  expect(page.textContent).toContain("Zoom call");
  await act(async () => finishRefresh({ items: [rows[0]!], nextCursor: "c2" }));
  expect(page.textContent).toContain("Zoom call");
});
