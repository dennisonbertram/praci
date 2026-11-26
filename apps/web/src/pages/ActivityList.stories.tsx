import type { RunActivityRow } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ActivityList } from "./ActivityList";

const row = (over: Partial<RunActivityRow>): RunActivityRow =>
  ({
    runId: "run_1",
    botId: "bot_ada",
    botName: "Ada",
    groupId: null,
    groupName: null,
    threadId: "thread_1",
    status: "running",
    trigger: "user",
    notificationsEnabled: false,
    promptSnippet: "Summarize the sample report",
    updatedAt: new Date().toISOString(),
    ...over,
  }) as RunActivityRow;

const active = [
  row({}),
  row({
    runId: "run_2",
    botName: "Ben",
    status: "waiting_input",
    promptSnippet: "Which sample file?",
  }),
  row({
    runId: "run_3",
    botName: "Cy",
    groupName: "Planning group",
    status: "queued",
    promptSnippet:
      "A very long prompt snippet that keeps going so the row has to truncate it instead of wrapping",
  }),
];
const recent = [
  row({ runId: "run_4", status: "completed", promptSnippet: "Draft the sample memo" }),
  row({
    runId: "run_5",
    botName: "Ben",
    status: "failed",
    promptSnippet: "Fetch the sample feed",
    error: "The sample feed request timed out.",
  }),
  row({ runId: "run_6", botName: "Cy", status: "cancelled", promptSnippet: "" }),
];

const byFilter = (input: unknown) =>
  (input as { filter: string }).filter === "active" ? { runs: active } : { runs: recent };

const meta = {
  title: "Shell/Activity list",
  component: ActivityList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Also shows: ActivityError, ActivityFilters, FilterChip, WaitingRow, ActivityRow",
      },
    },
  },
  args: { onOpenRun: () => {}, onOpenWaitingItem: () => {} },
  beforeEach: () => mockRpc({ "scratchpad.waitingOnYou": [] }),
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { beforeEach: () => mockRpc({ "runs.list": byFilter }) };

/** Open items that wait on the person, or are past due, sit right after Needs you. */
export const WaitingOnYou: Story = {
  beforeEach: () =>
    mockRpc({
      "runs.list": byFilter,
      "scratchpad.waitingOnYou": [
        {
          id: "item_1",
          botId: "bot_ada",
          botName: "Ada",
          title: "Sign the sample vendor form",
          waitingOn: "you",
          dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        },
        {
          id: "item_2",
          botId: "bot_ben",
          botName: "Ben",
          title: "Review the sample budget",
          waitingOn: null,
          dueAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        },
      ],
    }),
};

/** A quiet check-in that said nothing: dimmed, not counted under Finished. */
export const WithQuietRun: Story = {
  beforeEach: () =>
    mockRpc({
      "runs.list": (input: unknown) =>
        (input as { filter: string }).filter === "active"
          ? { runs: [] }
          : {
              runs: [
                ...recent,
                row({
                  runId: "run_quiet",
                  status: "completed",
                  trigger: "routine",
                  silent: true,
                  promptSnippet: "Check in for the user.",
                }),
              ],
            },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByTestId("activity-show-finished"));
  },
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "runs.list": () => new Promise(() => {}) }),
};

export const Empty: Story = { beforeEach: () => mockRpc({ "runs.list": { runs: [] } }) };

export const ErrorOnly: Story = {
  beforeEach: () =>
    mockRpc({
      "runs.list": () => {
        throw new Error("Could not load activity");
      },
    }),
};

/** Opens the filter popover. */
async function openFilters(canvasElement: HTMLElement) {
  await userEvent.click(await within(canvasElement).findByTestId("activity-show-filters"));
}

export const FilterOpen: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  play: async ({ canvasElement }) => openFilters(canvasElement),
};

export const FilteredToNothing: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  play: async ({ canvasElement }) => {
    await openFilters(canvasElement);
    await userEvent.type(await within(document.body).findByRole("searchbox"), "zzz-no-match");
  },
};

/** A search, a status and the sort bot name, all set in the URL. */
export const WithFilters: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  parameters: { initialEntries: ["/?activity-q=sample&activity-status=failed&activity-sort=bot"] },
  play: async ({ canvasElement }) => openFilters(canvasElement),
};

/** Inside the sidebar's scrolling column the section keeps its height next to a tall sibling. */
export const InSidebarColumn: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  decorators: [
    (Story) => (
      <div className="flex h-[640px] w-72 flex-col overflow-y-auto border border-border">
        <Story />
        <div className="h-[900px] shrink-0 px-2.5 text-[13px] text-muted-foreground">Chat list</div>
      </div>
    ),
  ],
};

const busy = Array.from({ length: 8 }, (_, index) =>
  row({
    runId: `run_busy_${index}`,
    botName: `Bot ${index + 1}`,
    status: index < 2 ? "waiting_input" : "running",
    promptSnippet: `Sample task ${index + 1}`,
  }),
);

/** Eight active runs in a sidebar-width column: at least five rows show before the list scrolls. */
export const ManyRuns: Story = {
  beforeEach: () =>
    mockRpc({
      "runs.list": (input: unknown) =>
        (input as { filter: string }).filter === "active" ? { runs: busy } : { runs: [] },
    }),
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col border border-border">
        <Story />
      </div>
    ),
  ],
};

const approvals = Array.from({ length: 4 }, (_, index) =>
  row({
    runId: `run_approval_${index}`,
    botName: `Bot ${index + 1}`,
    status: "waiting_input",
    needsApproval: true,
    promptSnippet: `Approve sample ${index + 1}`,
  }),
);

/** Four approvals plus one running: every "Needs you" row shows without an inner scroll. */
export const FourApprovals: Story = {
  beforeEach: () =>
    mockRpc({
      "runs.list": (input: unknown) =>
        (input as { filter: string }).filter === "active"
          ? { runs: [...approvals, ...busy.slice(2)] }
          : { runs: [] },
    }),
  decorators: [
    (Story) => (
      <div className="flex h-[393px] w-72 flex-col overflow-y-auto border border-border">
        <Story />
      </div>
    ),
  ],
};

/** In the phone drawer the whole column scrolls, so Working and the finished-runs button stay reachable. */
export const PhoneDrawer: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  decorators: [
    (Story) => (
      <div className="flex w-full flex-col">
        <Story />
      </div>
    ),
  ],
};
