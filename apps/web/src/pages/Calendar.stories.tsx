import type { CalendarAgenda, CalendarItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { mockBots } from "../stories/fixtures";
import { CalendarPage } from "./Calendar";

/** A time `days` from today at `hour` o'clock local. Dates move with the clock so Today and the window always line up. */
const at = (days: number, hour: number, minute = 0) => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
    hour,
    minute,
  ).toISOString();
};
/** An all-day item sits at midnight UTC of its date. */
const allDayAt = (days: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days)).toISOString();
};

const base = { end: null, botId: null, botName: null, account: null, href: null } as const;
const item = (i: Partial<CalendarItem> & Pick<CalendarItem, "id" | "kind" | "title" | "start">) =>
  ({ allDay: false, ...base, ...i }) satisfies CalendarItem;

const items: CalendarItem[] = [
  item({
    id: "e1",
    kind: "event",
    title: "Team standup",
    start: at(0, 9),
    end: at(0, 10),
    account: "Work",
    href: "https://calendar.example.test/e1",
  }),
  item({
    id: "t1",
    kind: "todo",
    title: "Send the investor update",
    start: at(0, 9, 30),
    botId: "bot_ada",
    botName: "Ada",
  }),
  item({
    id: "c1",
    kind: "check_back",
    title: "Check the pricing page",
    start: at(1, 15),
    botId: "bot_ben",
    botName: "Ben",
  }),
  item({
    id: "e3",
    kind: "event",
    title: "Customer call",
    start: at(0, 9, 15),
    end: at(0, 9, 45),
    account: "Work",
    href: "https://calendar.example.test/e3",
  }),
  item({
    id: "e2",
    kind: "event",
    title: "Offsite",
    start: allDayAt(2),
    allDay: true,
    account: "Personal",
    href: "https://calendar.example.test/e2",
  }),
  item({
    id: "inbox-todo:i1",
    kind: "todo",
    title: "Sign the lease form",
    start: allDayAt(0),
    allDay: true,
    mailId: "mail_1",
  }),
  item({
    id: "routine:r1",
    kind: "routine",
    title: "Weekly metrics digest",
    start: at(3, 14),
    botId: "bot_cy",
    botName: "Cy",
  }),
  item({ id: "i1", kind: "todo", title: "Sign the lease", start: allDayAt(3), allDay: true }),
];

const agenda = (over: Partial<CalendarAgenda> = {}): CalendarAgenda => ({
  items,
  errors: [],
  googleConnected: true,
  ...over,
});

const meta = {
  title: "Pages/Calendar",
  component: CalendarPage,
  args: { bots: mockBots, onOpenBot: () => {} },
  // The shell gives the page a bounded height; the time grid scrolls inside it.
  decorators: [
    (Story) => (
      <div className="flex h-screen flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Answers the way the API does: the bots' items for "local", the events for "google". */
const split = (data: CalendarAgenda) => (input: { sources?: "local" | "google" }) =>
  Promise.resolve({
    ...data,
    items: data.items.filter((entry) => (input.sources === "local") === (entry.kind !== "event")),
    errors: input.sources === "local" ? [] : data.errors,
  });
const withAgenda = (data: CalendarAgenda) => () =>
  mockRpc({ "calendar.agenda": split(data), "scratchpad.waitingOnYou": [] });
const view = (name: string) => ({ initialEntries: [`/app/calendar?view=${name}`] });

export const Week: Story = { beforeEach: withAgenda(agenda()) };

export const Day: Story = { parameters: view("day"), beforeEach: withAgenda(agenda()) };

export const MonthView: Story = { parameters: view("month"), beforeEach: withAgenda(agenda()) };

export const Schedule: Story = { parameters: view("schedule"), beforeEach: withAgenda(agenda()) };

export const ScheduleWithJoinLink: Story = {
  parameters: view("schedule"),
  beforeEach: withAgenda(
    agenda({
      items: items.map((entry) =>
        entry.id === "e1"
          ? {
              ...entry,
              // Starts soon, so Join shows whenever the story is opened.
              start: new Date(Date.now() + 30 * 60_000).toISOString(),
              end: new Date(Date.now() + 60 * 60_000).toISOString(),
              joinUrl: "https://meet.example.test/team",
            }
          : entry,
      ),
    }),
  ),
};

/** A bot's to-do in Schedule has a tick box; the inbox to-do below it has none. */
export const ScheduleTodoTickBox: Story = {
  parameters: view("schedule"),
  beforeEach: withAgenda(
    agenda({
      items: items.map((entry) =>
        entry.id === "t1"
          ? { ...entry, id: "todo:t1", start: at(1, 10) }
          : entry.id === "inbox-todo:i1"
            ? { ...entry, start: allDayAt(1) }
            : entry,
      ),
    }),
  ),
};

/** Clicking a Google event opens its details: time, who is going, Join while it is current, and a way out to Google. */
export const EventPopoverOpen: Story = {
  parameters: view("day"),
  beforeEach: withAgenda(
    agenda({
      items: items.map((entry) =>
        entry.id === "e1"
          ? {
              ...entry,
              start: new Date(Date.now() - 15 * 60_000).toISOString(),
              end: new Date(Date.now() + 45 * 60_000).toISOString(),
              joinUrl: "https://meet.example.test/team",
              attendees: ["Ana", "Ben", "Cy", "Dan", "Eli"],
              attendeeCount: 7,
            }
          : entry,
      ),
    }),
  ),
  play: async ({ canvasElement }) => {
    const grid = await within(canvasElement).findByRole("button", { name: /Team standup/ });
    await userEvent.click(grid);
  },
};

/** Bot items show at once; the Google request is still pending, so only the small spinner marks it. */
export const GoogleLoading: Story = {
  beforeEach: () =>
    mockRpc({
      "calendar.agenda": (input: { sources?: "local" | "google" }) =>
        input.sources === "google" ? new Promise(() => {}) : split(agenda())(input),
      "scratchpad.waitingOnYou": [],
    }),
};

export const GoogleError: Story = {
  beforeEach: withAgenda(
    agenda({
      items: items.filter((entry) => entry.account !== "Work"),
      errors: [{ account: "Work", message: "Couldn't load Work" }],
    }),
  ),
};

export const GoogleReconnect: Story = {
  beforeEach: withAgenda(
    agenda({
      items: items.filter((entry) => entry.account !== "Work"),
      errors: [{ account: "Work", message: "x", reconnect: true }],
    }),
  ),
};

/** Three items at the same time cascade, each titled, instead of shrinking to slivers. */
export const OverlappingWeek: Story = {
  beforeEach: withAgenda(
    agenda({
      items: [
        item({
          id: "o1",
          kind: "todo",
          title: "Send the investor update",
          start: at(1, 9),
          botId: "bot_ada",
          botName: "Ada",
        }),
        item({
          id: "o2",
          kind: "todo",
          title: "Review the board deck",
          start: at(1, 9),
          botId: "bot_ben",
          botName: "Ben",
        }),
        item({
          id: "o3",
          kind: "todo",
          title: "Reply to Priya",
          start: at(1, 9, 15),
          botId: "bot_cy",
          botName: "Cy",
        }),
      ],
    }),
  ),
};

export const EmptyWeek: Story = { beforeEach: withAgenda(agenda({ items: [] })) };

/** A kind filter is set, so the Filters button shows as active. */
export const FilteredToCheckBacks: Story = {
  parameters: view("week&kind=check_back"),
  beforeEach: withAgenda(agenda()),
};

export const Searched: Story = {
  beforeEach: withAgenda(agenda()),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Filters" }));
    await userEvent.type(await within(document.body).findByRole("searchbox"), "zzz");
  },
};

/** Bot items still show, with one quiet link to connect Google Calendar. */
export const NoGoogleCalendar: Story = {
  beforeEach: withAgenda(
    agenda({ items: items.filter((entry) => entry.kind !== "event"), googleConnected: false }),
  ),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "calendar.agenda": () => {
        throw new Error("Could not load the calendar");
      },
      "scratchpad.waitingOnYou": [],
    }),
};

const phone = {
  globals: { viewport: { value: "mobile1" } },
};

/** Under 640px wide the page opens on Schedule, with one toolbar row and the filters in a sheet. */
export const PhoneSchedule: Story = { ...phone, beforeEach: withAgenda(agenda()) };

/** Week becomes three days, so no day is off screen and the hour column stays in view. */
export const PhoneThreeDays: Story = {
  ...phone,
  parameters: view("week"),
  beforeEach: withAgenda(agenda()),
};

/** Days show dots; tapping one lists its items below the month. */
export const PhoneMonth: Story = {
  ...phone,
  parameters: view("month"),
  beforeEach: withAgenda(agenda()),
};

export const PhoneEmptyDay: Story = {
  ...phone,
  parameters: view("day"),
  beforeEach: withAgenda(agenda({ items: [] })),
};

/** A daily routine and a weekly one come back once per run: every day in Week and Month, one row each in Schedule. */
export const RepeatingRoutines: Story = {
  beforeEach: withAgenda(
    agenda({
      items: [
        ...items.filter((entry) => entry.kind !== "routine"),
        ...Array.from({ length: 14 }, (_, day) =>
          item({
            id: `routine:r2:${day}`,
            kind: "routine",
            title: "Morning briefing",
            start: at(day - 3, 8),
            botId: "bot_ada",
            botName: "Ada",
          }),
        ),
        ...[0, 7].map((day) =>
          item({
            id: `routine:r3:${day}`,
            kind: "routine",
            title: "Weekly metrics digest",
            start: at(day, 14),
            botId: "bot_cy",
            botName: "Cy",
          }),
        ),
      ],
    }),
  ),
};
