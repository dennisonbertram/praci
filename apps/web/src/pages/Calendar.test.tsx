// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { CalendarAgenda, CalendarItem } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const agendaMock = vi.hoisted(() => vi.fn());
const waitingMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/rpc", () => ({
  rpc: {
    calendar: { agenda: agendaMock },
    scratchpad: { waitingOnYou: waitingMock, update: updateMock },
  },
}));

import { CalendarPage } from "./Calendar";

i18n.loadAndActivate({ locale: "en", messages: {} });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const now = new Date();
const at = (days: number, hour: number) =>
  new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days, hour)).toISOString();
const base = { end: null, allDay: false, botId: null, botName: null, account: null, href: null };
const agenda = (over: Partial<CalendarAgenda> = {}): CalendarAgenda => ({
  items: [
    { ...base, id: "e1", kind: "event", title: "Board call", start: at(1, 15), account: "Work" },
    {
      ...base,
      id: "c1",
      kind: "check_back",
      title: "Look at pricing",
      start: at(2, 15),
      botId: "b1",
      botName: "Ada",
    },
  ],
  errors: [],
  googleConnected: true,
  ...over,
});

/** Answers the way the API does: the bots' items for "local", the rest for "google". */
const answer = (full: CalendarAgenda) => (input: { sources?: "local" | "google" }) =>
  Promise.resolve({
    ...full,
    items: full.items.filter((item) => (input.sources === "local") === (item.kind !== "event")),
    errors: input.sources === "local" ? [] : full.errors,
  });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const mount = async (entry = "/app/calendar") => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <I18nProvider i18n={i18n}>
          <LocationSearch />
          <CalendarPage />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  await flush();
};

function LocationSearch() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  agendaMock.mockReset();
  waitingMock.mockReset();
  waitingMock.mockResolvedValue([]);
  updateMock.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("puts the desktop filters behind the same button the phone has", async () => {
  agendaMock.mockImplementation(answer(agenda()));
  await mount("/app/calendar?view=schedule");
  const button = container.querySelector('button[aria-label="Filters"]');
  expect(button).not.toBeNull();
  // Nothing is filtered, so the button is quiet and no search field sits in the open.
  expect(button?.className).not.toContain("bg-secondary");
  expect(container.querySelector('[name="calendar-search"]')).toBeNull();
  await click(button);
  expect(document.querySelector('[name="calendar-search"]')).not.toBeNull();
});

it("shows the desktop Filters button as active when a filter is set", async () => {
  agendaMock.mockImplementation(answer(agenda()));
  await mount("/app/calendar?view=schedule&kind=todo");
  expect(container.querySelector('button[aria-label="Filters"]')?.className).toContain(
    "bg-secondary",
  );
});

it("lists items and filters by kind from the URL", async () => {
  agendaMock.mockImplementation(answer(agenda()));
  await mount("/app/calendar?view=schedule");
  expect(container.textContent).toContain("Board call");
  expect(container.textContent).toContain("Look at pricing");
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount("/app/calendar?view=schedule&kind=check_back");
  expect(container.textContent).not.toContain("Board call");
  expect(container.textContent).toContain("Look at pricing");
});

it("says nothing is scheduled when the list is empty", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=schedule");
  expect(container.textContent).toContain("Nothing scheduled");
});

it("names an account that could not load and offers to connect Google when none is", async () => {
  agendaMock.mockImplementation(
    answer(agenda({ errors: [{ account: "Work", message: "x" }], googleConnected: false })),
  );
  await mount("/app/calendar?view=schedule");
  expect(container.textContent).toContain("Couldn't load Work");
  expect(container.textContent).toContain("Connect Google Calendar");
  expect(container.textContent).toContain("Look at pricing");
});

it("offers to reconnect a Google account that needs authorization", async () => {
  agendaMock.mockImplementation(
    answer(agenda({ errors: [{ account: "Work", message: "x", reconnect: true }] })),
  );
  await mount("/app/calendar?view=schedule");
  const reconnect = [...container.querySelectorAll("a")].find((a) => a.textContent === "Reconnect");
  expect(reconnect?.getAttribute("href")).toBe(
    "/app/integrations?open=googlecalendar&returnTo=/app/calendar",
  );
  expect(container.textContent).not.toContain("x");
});

it("does not offer to connect Google alongside a local calendar load error", async () => {
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
    input.sources === "local"
      ? Promise.reject(new Error("offline"))
      : answer(agenda({ items: [], googleConnected: false }))(input),
  );
  await mount("/app/calendar?view=schedule");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("offline");
  expect(container.textContent).not.toContain("Connect Google Calendar");
});

it("reloads both sources when the local load error is retried", async () => {
  let failLocal = true;
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
    input.sources === "local" && failLocal
      ? Promise.reject(new Error("offline"))
      : answer(agenda({ items: [] }))(input),
  );
  await mount("/app/calendar?view=schedule");
  failLocal = false;
  const retry = [...container.querySelectorAll('[role="alert"] button')].find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => (retry as HTMLElement).click());
  const calls = (source: string) =>
    agendaMock.mock.calls.filter(([input]) => input.sources === source).length;
  expect(calls("local")).toBe(2);
  expect(calls("google")).toBe(2);
});

it("offers one Google retry button for the group of account errors", async () => {
  agendaMock.mockImplementation(
    answer(
      agenda({
        errors: [
          { account: "Work", message: "x" },
          { account: "Personal", message: "y" },
        ],
      }),
    ),
  );
  await mount("/app/calendar?view=schedule");
  const retry = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );
  expect(retry).toBeTruthy();
  await act(async () => retry!.click());
  expect(agendaMock.mock.calls.filter(([input]) => input.sources === "google")).toHaveLength(2);
});

it("keeps items visible when a background local refresh fails", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [local("keep", "Keep visible", noon())] })));
  await mount();
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
    input.sources === "local"
      ? Promise.reject(new Error("offline"))
      : answer(agenda({ items: [] }))(input),
  );
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Keep visible");
  expect(container.textContent).not.toContain("Could not load the calendar");
});

it("shows Join for an active linked event as a sibling of its card link", async () => {
  const soon = new Date(Date.now() + 60 * 60_000).toISOString();
  const ended = new Date(Date.now() - 60 * 60_000).toISOString();
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [
          {
            ...base,
            id: "join",
            kind: "event",
            title: "Joinable",
            start: soon,
            account: "Work",
            href: "https://calendar.example/e",
            joinUrl: "https://meet.example/join",
          },
          {
            ...base,
            id: "ended",
            kind: "event",
            title: "Ended",
            start: ended,
            end: ended,
            account: "Work",
            href: "https://calendar.example/old",
            joinUrl: "https://meet.example/old",
          },
        ],
      }),
    ),
  );
  await mount("/app/calendar?view=schedule");
  const join = [...container.querySelectorAll("a")].find((a) => a.textContent === "Join");
  expect(join?.getAttribute("aria-label")).toBe("Join Joinable");
  expect(join?.target).toBe("_blank");
  expect(join?.closest("a[href='https://calendar.example/e']")).toBeNull();
  expect(container.textContent).not.toContain("Join Ended");
});

const local = (id: string, title: string, start: Date, over: Partial<CalendarItem> = {}) => ({
  ...base,
  id,
  kind: "todo" as const,
  title,
  start: start.toISOString(),
  botId: "b1",
  botName: "Ada",
  ...over,
});
const noon = () => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
const column = (day: string) => container.querySelector(`[data-day="${day}"]`)!;
const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

it("shows the week grid and the bots' items while Google is still loading", async () => {
  agendaMock.mockImplementation((input: { sources?: string }) =>
    input.sources === "google"
      ? new Promise(() => {})
      : Promise.resolve(agenda({ items: [local("t1", "Send deck", noon())] })),
  );
  // The owner chose Day as the desktop default, so the week is named here.
  await mount("/app/calendar?view=week");
  expect(container.querySelectorAll("[data-day]")).toHaveLength(7);
  expect(column(localDay(now)).textContent).toContain("Send deck");
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  expect(container.querySelector("[data-now-line]")).not.toBeNull();
});

it("draws the week grid with nothing in it", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=week");
  expect(container.querySelectorAll("[data-day]")).toHaveLength(7);
});

it("opens on the Day view on a desktop", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount();
  expect(container.querySelectorAll("[data-day]")).toHaveLength(1);
  expect(column(localDay(now))).not.toBeNull();
});

it("switches views through the URL and the buttons", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=day");
  expect(container.querySelectorAll("[data-day]")).toHaveLength(1);
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  await act(async () => button("Week").click());
  expect(container.querySelectorAll("[data-day]")).toHaveLength(7);
  await act(async () => button("Month").click());
  expect(container.querySelector("table")).not.toBeNull();
  await act(async () => button("Schedule").click());
  expect(container.textContent).toContain("Nothing scheduled");
  const requests = agendaMock.mock.calls.map(([input]) => input.sources);
  expect(requests).toContain("local");
  expect(requests).toContain("google");
});

it("steps to the next period and back to today", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=day");
  const label = (name: string) => container.querySelector(`[aria-label="${name}"]`) as HTMLElement;
  const first = () => container.querySelector("[data-day]")!.getAttribute("data-day");
  const todayDay = first();
  await act(async () => label("Next").click());
  expect(first()).toBe(localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)));
  const todayButton = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Today",
  )!;
  await act(async () => todayButton.click());
  expect(first()).toBe(todayDay);
});

it("selects the first day when a phone month arrow enters another month and today when it returns", async () => {
  asPhone();
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=month");
  const twentieth = `${localDay(now).slice(0, 7)}-20`;
  await act(async () => column(twentieth).querySelector("button")?.click());
  expect(column(twentieth).querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  const button = (name: string) => container.querySelector(`[aria-label="${name}"]`) as HTMLElement;
  await act(async () => button("Next").click());
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstOfNextMonth = localDay(nextMonth);
  expect(column(firstOfNextMonth).querySelector("button")?.getAttribute("aria-pressed")).toBe(
    "true",
  );
  await act(async () => button("Previous").click());
  const today = localDay(now);
  expect(column(today).querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelector('[data-testid="location-search"]')?.textContent).toBe(
    "?view=month",
  );
});

it("keeps phone Day and Week arrows moving by their existing ranges", async () => {
  asPhone();
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  const date = localDay(now);
  await mount(`/app/calendar?view=day&date=${date}`);
  const button = (name: string) => container.querySelector(`[aria-label="${name}"]`) as HTMLElement;
  await act(async () => button("Next").click());
  expect(container.querySelector('[data-testid="location-search"]')?.textContent).toContain(
    localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount(`/app/calendar?view=week&date=${date}`);
  await act(async () => button("Next").click());
  expect(container.querySelector('[data-testid="location-search"]')?.textContent).toContain(
    localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)),
  );
});

it("puts an item at 23:30 local on its own day, not the next", async () => {
  const late = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 30);
  agendaMock.mockImplementation(answer(agenda({ items: [local("t2", "Late call", late)] })));
  await mount("/app/calendar?view=month");
  expect(column(localDay(late)).textContent).toContain("Late call");
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (localDay(next).slice(0, 7) === localDay(now).slice(0, 7))
    expect(column(localDay(next)).textContent).not.toContain("Late call");
});

it("keeps titles and drops icons when items overlap", async () => {
  const at9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
  agendaMock.mockImplementation(
    answer(agenda({ items: [local("a", "First thing", at9), local("b", "Second thing", at9)] })),
  );
  await mount();
  const col = column(localDay(at9));
  expect(col.textContent).toContain("First thing");
  expect(col.textContent).toContain("Second thing");
  expect(col.querySelector('[role="img"]')).toBeNull();
});

it("shows open to-dos waiting on the person above the grid, and still loads without them", async () => {
  agendaMock.mockImplementation(answer(agenda()));
  waitingMock.mockResolvedValue([
    {
      id: "t1",
      botId: "b1",
      botName: "Ada",
      title: "Sign the form",
      waitingOn: "you",
      dueAt: null,
    },
  ]);
  await mount("/app/calendar?view=week");
  expect(container.textContent).toContain("Sign the form");
  await act(async () => root.unmount());
  root = createRoot(container);
  waitingMock.mockRejectedValue(new Error("down"));
  await mount("/app/calendar?view=week");
  expect(container.textContent).not.toContain("Sign the form");
  expect(container.textContent).toContain("Calendar");
});

/** Makes the page see a phone for the length of one test. */
const asPhone = () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};
afterEach(() => vi.unstubAllGlobals());
const link = (title: string) =>
  [...container.querySelectorAll("a")].find((a) => a.textContent?.includes(title));

it("opens on Schedule on a phone and shows three days instead of the week", async () => {
  asPhone();
  agendaMock.mockImplementation(answer(agenda()));
  await mount();
  expect(container.textContent).toContain("Board call");
  expect(container.querySelector("[data-day]")).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount("/app/calendar?view=week");
  expect(container.querySelectorAll("[data-day]")).toHaveLength(3);
});

it("opens a to-do's mail and a routine's own editor from the schedule", async () => {
  asPhone();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [
          local("inbox-todo:i1", "Sign form", tomorrow, { botId: null, mailId: "m1" }),
          local("routine:r1", "Daily scan", tomorrow, { kind: "routine" }),
        ],
      }),
    ),
  );
  await mount();
  expect(link("Sign form")?.getAttribute("href")).toBe("/app/inbox?mail=m1");
  expect(link("Daily scan")?.getAttribute("href")).toBe("/app/b1?routine=r1");
});

it("lists the tapped day under a phone's month and says when a day is empty", async () => {
  asPhone();
  const noonToday = noon();
  agendaMock.mockImplementation(answer(agenda({ items: [local("t1", "Send deck", noonToday)] })));
  await mount("/app/calendar?view=month");
  const cell = column(localDay(now)).querySelector("button") as HTMLButtonElement;
  expect(container.querySelector(`[data-day="${localDay(now)}"] [data-dots="1"]`)).not.toBeNull();
  await act(async () => cell.click());
  expect(container.querySelector(`section[aria-label="${localDay(now)}"]`)?.textContent).toContain(
    "Send deck",
  );
  const empty = new Date(now.getFullYear(), now.getMonth(), 28 === now.getDate() ? 27 : 28);
  const emptyCell = column(localDay(empty)).querySelector("button") as HTMLButtonElement;
  await act(async () => emptyCell.click());
  expect(
    container.querySelector(`section[aria-label="${localDay(empty)}"]`)?.textContent,
  ).toContain("Nothing scheduled");
});

it("selects the phone month day from the URL and lists its items", async () => {
  asPhone();
  const selected = new Date(now.getFullYear(), now.getMonth(), now.getDate() === 1 ? 2 : 1, 12);
  const date = localDay(selected);
  agendaMock.mockImplementation(
    answer(agenda({ items: [local("picked", "Selected day item", selected)] })),
  );
  await mount(`/app/calendar?view=month&date=${date}`);
  const selectedButton = column(date).querySelector("button") as HTMLButtonElement;
  expect(selectedButton.getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);
  expect(container.querySelector(`section[aria-label="${date}"]`)?.textContent).toContain(
    "Selected day item",
  );
  expect(column(localDay(now)).querySelector("time")?.className).toContain("rounded-full");
});

it("says a phone's empty day is empty", async () => {
  asPhone();
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=day");
  expect(container.textContent).toContain("Nothing scheduled");
});

it("says a desktop Day is empty", async () => {
  agendaMock.mockImplementation(answer(agenda({ items: [] })));
  await mount("/app/calendar?view=day");
  expect(container.textContent).toContain("Nothing scheduled");
});

it("hides the empty day message while Google Calendar has an error", async () => {
  asPhone();
  agendaMock.mockImplementation(
    answer(agenda({ items: [], errors: [{ account: "Work", message: "timeout" }] })),
  );
  await mount("/app/calendar?view=day");
  expect(container.textContent).toContain("Couldn't load Work");
  expect(container.textContent).not.toContain("Nothing scheduled");
});

it("hides the empty phone Day message while the local calendar has an error", async () => {
  asPhone();
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
    input.sources === "local"
      ? Promise.reject(new Error("offline"))
      : answer(agenda({ items: [] }))(input),
  );
  await mount("/app/calendar?view=day");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("offline");
  expect(container.textContent).not.toContain("Nothing scheduled");
});

it.each(["google", "local"] as const)(
  "hides the empty phone month day list while %s Calendar loading fails",
  async (source) => {
    asPhone();
    const day = localDay(now);
    agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
      input.sources === source
        ? source === "local"
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({
              ...agenda({ items: [], errors: [{ account: "Work", message: "timeout" }] }),
              items: [],
            })
        : answer(agenda({ items: [] }))(input),
    );
    await mount(`/app/calendar?view=month&date=${day}`);
    expect(container.querySelector(`section[aria-label="${day}"]`)?.textContent).not.toContain(
      "Nothing scheduled",
    );
  },
);

it.each(["google", "local"] as const)(
  "hides the empty schedule message while %s Calendar loading fails",
  async (source) => {
    agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
      input.sources === source
        ? source === "local"
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({
              ...agenda({ items: [], errors: [{ account: "Work", message: "timeout" }] }),
              items: [],
            })
        : answer(agenda({ items: [] }))(input),
    );
    await mount("/app/calendar?view=schedule");
    expect(container.textContent).not.toContain("Nothing scheduled");
  },
);

it("lists a repeating routine once in the schedule and opens it by its routine id", async () => {
  asPhone();
  const run = (days: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 8);
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [1, 2, 3].map((days) =>
          local(`routine:r1:${run(days).toISOString()}`, "Morning briefing", run(days), {
            kind: "routine",
          }),
        ),
      }),
    ),
  );
  await mount();
  const rows = [...container.querySelectorAll("a")].filter((a) =>
    a.textContent?.includes("Morning briefing"),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.getAttribute("href")).toBe("/app/b1?routine=r1");
});

it("puts the Connect link before the grid", async () => {
  agendaMock.mockImplementation(answer(agenda({ googleConnected: false })));
  await mount();
  const connect = [...container.querySelectorAll("a")].find((a) =>
    a.textContent?.includes("Connect Google Calendar"),
  )!;
  const grid = container.querySelector("[data-day]")!;
  expect(connect.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("lists a meeting before a routine in a month cell, whatever the time", async () => {
  const day = (hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [
          local("routine:r1:x", "Morning briefing", day(7), {
            kind: "routine",
          }),
          local("e1", "Board call", day(10), {
            kind: "event",
            botId: null,
            botName: null,
          }),
        ],
      }),
    ),
  );
  await mount("/app/calendar?view=month");
  const cell = column(localDay(now)).textContent ?? "";
  expect(cell.indexOf("Board call")).toBeGreaterThan(-1);
  expect(cell.indexOf("Board call")).toBeLessThan(cell.indexOf("Morning briefing"));
});

it("draws timed items and the now line by wall-clock time on a daylight-saving day", async () => {
  const zone = process.env.TZ;
  process.env.TZ = "America/New_York";
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    // Clocks go back at 2:00 AM on Sun 2026-11-01, so that day has 25 hours.
    vi.setSystemTime(new Date(2026, 10, 1, 14, 0));
    const hourFrom = (day: number) => ({ end: new Date(2026, 10, day, 15, 0).toISOString() });
    const items = [
      local("d1", "Switch day", new Date(2026, 10, 1, 14, 0), hourFrom(1)),
      local("d2", "Normal day", new Date(2026, 10, 2, 14, 0), hourFrom(2)),
    ];
    agendaMock.mockImplementation(answer(agenda({ items })));
    // The owner chose Day as the desktop default; this needs both days on one grid.
    await mount("/app/calendar?view=week");
    const styleOf = (day: string, title: string) =>
      Array.from(column(day).querySelectorAll<HTMLElement>("*")).find(
        (el) => el.style.top && el.textContent?.includes(title),
      )!.style;
    expect(styleOf("2026-11-01", "Switch day").top).toBe("672px");
    expect(styleOf("2026-11-01", "Switch day").height).toBe("48px");
    expect(styleOf("2026-11-02", "Normal day").top).toBe("672px");
    expect((column("2026-11-01").querySelector("[data-now-line]") as HTMLElement).style.top).toBe(
      "672px",
    );
  } finally {
    vi.useRealTimers();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});

it("finishes a slow Google load even when a background refresh fires meanwhile", async () => {
  let finishGoogle!: (value: CalendarAgenda) => void;
  let googleCalls = 0;
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) => {
    if (input.sources !== "google") return answer(agenda({ items: [] }))(input);
    googleCalls += 1;
    return new Promise<CalendarAgenda>((resolve) => {
      finishGoogle = resolve;
    });
  });
  await mount("/app/calendar?view=schedule");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(googleCalls).toBe(1);
  await act(async () => finishGoogle(agenda()));
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(container.textContent).toContain("Board call");
});

const googleEvent = (id: string, title: string, account: string): CalendarItem => ({
  ...base,
  id,
  kind: "event",
  title,
  start: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  account,
});

it("keeps an account's events when a background refresh fails for that account", async () => {
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [googleEvent("w", "Work sync", "Work"), googleEvent("p", "Dentist", "Home")],
      }),
    ),
  );
  await mount("/app/calendar?view=schedule");
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [googleEvent("p", "Dentist", "Home")],
        errors: [{ account: "Work", message: "timeout" }],
      }),
    ),
  );
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Work sync");
  expect(container.textContent).toContain("Dentist");
  expect(container.textContent).toContain("Couldn't load Work");
});

it("does not duplicate an event returned with a partial account error", async () => {
  const work = googleEvent("w", "Work sync", "Work");
  agendaMock.mockImplementation(answer(agenda({ items: [work] })));
  await mount("/app/calendar?view=schedule");
  agendaMock.mockImplementation(
    answer(agenda({ items: [work], errors: [{ account: "Work", message: "partial" }] })),
  );
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(
    [...container.querySelectorAll("a")].filter((a) => a.textContent?.includes("Work sync")),
  ).toHaveLength(1);
});

it("clears the calendar error when a background refresh succeeds", async () => {
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) =>
    input.sources === "local" ? Promise.reject(new Error("offline")) : answer(agenda())(input),
  );
  await mount("/app/calendar?view=schedule");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("offline");
  agendaMock.mockImplementation(answer(agenda()));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("does not start a second background Google scan while one is still running", async () => {
  agendaMock.mockImplementation(answer(agenda()));
  await mount("/app/calendar?view=schedule");
  let googleCalls = 0;
  agendaMock.mockImplementation((input: { sources?: "local" | "google" }) => {
    if (input.sources !== "google") return answer(agenda())(input);
    googleCalls += 1;
    return new Promise(() => {});
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(googleCalls).toBe(1);
});

it("keeps Join on an all-day call until local midnight", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 22, 0));
  try {
    agendaMock.mockImplementation(
      answer(
        agenda({
          items: [
            {
              ...base,
              id: "allday",
              kind: "event",
              title: "Offsite call",
              allDay: true,
              start: "2026-11-09T00:00:00.000Z",
              end: "2026-11-10T00:00:00.000Z",
              account: "Work",
              joinUrl: "https://meet.example/offsite",
            },
          ],
        }),
      ),
    );
    await mount("/app/calendar?view=schedule");
    expect(container.querySelector('a[href="https://meet.example/offsite"]')).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it("gives an event with no end an hour in the grid and keeps Join for it", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
  try {
    agendaMock.mockImplementation(
      answer(
        agenda({
          items: [
            {
              ...base,
              id: "noend",
              kind: "event",
              title: "Open-ended call",
              start: new Date(2026, 10, 9, 11, 15).toISOString(),
              account: "Work",
              joinUrl: "https://meet.example/noend",
            },
            local("bot", "Bot item", new Date(2026, 10, 9, 15, 0)),
          ],
        }),
      ),
    );
    await mount("/app/calendar?view=day&date=2026-11-09");
    const blockOf = (title: string) =>
      [...column("2026-11-09").querySelectorAll<HTMLElement>("a, button")].find((el) =>
        el.textContent?.includes(title),
      )!;
    expect(parseFloat(blockOf("Open-ended call").style.height)).toBeGreaterThanOrEqual(48);
    expect(parseFloat(blockOf("Bot item").style.height)).toBe(24);
    await act(async () => {
      [...container.querySelectorAll("button")].find((b) => b.textContent === "Schedule")!.click();
    });
    expect(container.querySelector('a[href="https://meet.example/noend"]')).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

const click = (el: Element | undefined | null) => act(async () => (el as HTMLElement).click());
const popup = () => document.querySelector('[data-slot="popover-content"]');
const linkIn = (root: ParentNode | null, text: string) =>
  [...(root?.querySelectorAll("a") ?? [])].find((a) => a.textContent === text);
const googleAt = (id: string, title: string, start: Date, over: Partial<CalendarItem> = {}) => ({
  ...base,
  id,
  kind: "event" as const,
  title,
  start: start.toISOString(),
  account: "Work",
  href: `https://calendar.example/${id}`,
  ...over,
});

it("opens a Google event in a popover with Join and Open in Google", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
  try {
    agendaMock.mockImplementation(
      answer(
        agenda({
          items: [
            googleAt("live", "Standup", new Date(2026, 10, 9, 11, 30), {
              end: new Date(2026, 10, 9, 12, 30).toISOString(),
              joinUrl: "https://meet.example/live",
            }),
          ],
        }),
      ),
    );
    await mount("/app/calendar?view=week&date=2026-11-09");
    const trigger = column("2026-11-09").querySelector("button");
    expect(trigger?.getAttribute("aria-label")).toContain("Standup");
    expect(column("2026-11-09").querySelector("a")).toBeNull();
    await click(trigger);
    const join = linkIn(popup(), "Join");
    expect(join?.getAttribute("href")).toBe("https://meet.example/live");
    expect(join?.getAttribute("aria-label")).toBe("Join Standup");
    const open = linkIn(popup(), "Open in Google");
    expect(open?.getAttribute("href")).toBe("https://calendar.example/live");
    expect(open?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(open?.target).toBe("_blank");
  } finally {
    vi.useRealTimers();
  }
});

it("shows who is attending in the event popover", async () => {
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [
          googleAt("meet", "Design review", new Date(2026, 10, 9, 10, 0), {
            end: new Date(2026, 10, 9, 11, 0).toISOString(),
            attendees: ["Ana", "Ben", "Cy", "Dan", "Eli"],
            attendeeCount: 7,
          }),
        ],
      }),
    ),
  );
  await mount("/app/calendar?view=day&date=2026-11-09");
  await click(column("2026-11-09").querySelector("button"));
  expect(popup()?.textContent).toContain("Ana, Ben, Cy, Dan, Eli +2 more");
});

it("shows no Join for a past event and the account only with several accounts", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
  try {
    agendaMock.mockImplementation(
      answer(
        agenda({
          items: [
            googleAt("old", "Retro", new Date(2026, 10, 9, 8, 0), {
              end: new Date(2026, 10, 9, 9, 0).toISOString(),
              joinUrl: "https://meet.example/old",
            }),
          ],
        }),
      ),
    );
    await mount("/app/calendar?view=day&date=2026-11-09");
    await click(column("2026-11-09").querySelector("button"));
    expect(linkIn(popup(), "Join")).toBeUndefined();
    expect(popup()?.textContent).not.toContain("Work");
    await act(async () => root.unmount());
    root = createRoot(container);
    agendaMock.mockImplementation(
      answer(
        agenda({
          items: [
            googleAt("a", "Retro", new Date(2026, 10, 9, 8, 0)),
            googleAt("b", "Lunch", new Date(2026, 10, 9, 13, 0), { account: "Home" }),
          ],
        }),
      ),
    );
    await mount("/app/calendar?view=day&date=2026-11-09");
    await click(column("2026-11-09").querySelector("button"));
    expect(popup()?.textContent).toContain("Work");
  } finally {
    vi.useRealTimers();
  }
});

it("opens one popover with the full range for a multi-day all-day bar, and the real span across midnight", async () => {
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [
          googleAt("trip", "Offsite", new Date(2026, 10, 9), {
            allDay: true,
            start: "2026-11-09T00:00:00.000Z",
            end: "2026-11-12T00:00:00.000Z",
          }),
          googleAt("late", "Deploy", new Date(2026, 10, 9, 23, 0), {
            end: new Date(2026, 10, 10, 1, 0).toISOString(),
          }),
        ],
      }),
    ),
  );
  await mount("/app/calendar?view=week&date=2026-11-09");
  await click(container.querySelector('[data-all-day="2026-11-09"] button'));
  expect(popup()?.textContent).toContain("Nov 9");
  expect(popup()?.textContent).toContain("Nov 11");
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(popup()).toBeNull();
  await click(
    [...column("2026-11-09").querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Deploy"),
    ),
  );
  expect(popup()?.textContent).toMatch(/Nov 9.*11:00.*Nov 10.*1:00/s);
});

it("opens a Google chip in the month view and keeps the schedule row a direct link", async () => {
  agendaMock.mockImplementation(
    answer(agenda({ items: [googleAt("m", "Planning", new Date(2026, 10, 9, 10, 0))] })),
  );
  await mount("/app/calendar?view=month&date=2026-11-09");
  await click(column("2026-11-09").querySelector("button"));
  expect(linkIn(popup(), "Open in Google")?.getAttribute("href")).toBe(
    "https://calendar.example/m",
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10);
  agendaMock.mockImplementation(answer(agenda({ items: [googleAt("m", "Planning", soon)] })));
  await mount("/app/calendar?view=schedule");
  expect(container.querySelector("a[href='https://calendar.example/m']")).not.toBeNull();
});

it("keeps the touch band and block size on the popover trigger", async () => {
  agendaMock.mockImplementation(
    answer(agenda({ items: [googleAt("t", "Sync", new Date(2026, 10, 9, 10, 0))] })),
  );
  await mount("/app/calendar?view=day&date=2026-11-09");
  const trigger = column("2026-11-09").querySelector<HTMLElement>("button")!;
  expect(trigger.className).toContain("pointer-coarse:after:-inset-y-2.5");
  expect(trigger.style.height).toBe("48px");
});

it("ticks a bot to-do done in the schedule and gives an inbox to-do no tick box", async () => {
  updateMock.mockResolvedValue({});
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10);
  agendaMock.mockImplementation(
    answer(
      agenda({
        items: [
          local("todo:abc", "Send deck", tomorrow),
          local("inbox-todo:xyz", "Reply to Sam", tomorrow, { botId: null, botName: null }),
        ],
      }),
    ),
  );
  await mount("/app/calendar?view=schedule");
  const boxes = container.querySelectorAll('[role="checkbox"]');
  expect(boxes).toHaveLength(1);
  expect(boxes[0]?.getAttribute("aria-label")).toBe("Send deck");
  await click(boxes[0]);
  expect(updateMock).toHaveBeenCalledWith({ itemId: "abc", status: "done" });
  expect(container.textContent).not.toContain("Send deck");
  expect(container.textContent).toContain("Reply to Sam");
});

it("keeps the row and says so when marking a to-do done fails", async () => {
  updateMock.mockRejectedValue(new Error("no"));
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10);
  agendaMock.mockImplementation(
    answer(agenda({ items: [local("todo:abc", "Send deck", tomorrow)] })),
  );
  await mount("/app/calendar?view=schedule");
  await click(container.querySelector('[role="checkbox"]'));
  expect(container.textContent).toContain("Send deck");
  expect(container.textContent).toContain("Could not update");
});

it("refreshes the bots' items every minute and Google every five", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    agendaMock.mockImplementation(answer(agenda({ items: [] })));
    await mount("/app/calendar?view=schedule");
    const calls = (source: string) =>
      agendaMock.mock.calls.filter(([input]) => input.sources === source).length;
    expect([calls("local"), calls("google")]).toEqual([1, 1]);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect([calls("local"), calls("google")]).toEqual([2, 1]);
    await act(async () => vi.advanceTimersByTimeAsync(4 * 60_000));
    expect(calls("local")).toBe(6);
    expect(calls("google")).toBe(2);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect([calls("local"), calls("google")]).toEqual([7, 3]);
  } finally {
    vi.useRealTimers();
  }
});
