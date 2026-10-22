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
  row({ runId: "run_5", botName: "Ben", status: "failed", promptSnippet: "Fetch the sample feed" }),
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
        component: "Also shows: ActivityError, ActivityFilters, FilterChip, ActivityRow",
      },
    },
  },
  args: { onOpenRun: () => {} },
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

/** Opens the filter popover and its "More filters" fields. */
async function openFilters(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByTestId("activity-show-filters"));
  await userEvent.click(await within(document.body).findByText("More filters"));
}

export const FilterOpen: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByTestId("activity-show-filters"));
  },
};

export const FilteredToNothing: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  play: async ({ canvasElement }) => {
    await openFilters(canvasElement);
    const search = await within(document.body).findByTestId("activity-search");
    await userEvent.type(search, "zzz-no-match");
  },
};

export const WithFilterChips: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  play: async ({ canvasElement }) => {
    await openFilters(canvasElement);
    const search = await within(document.body).findByTestId("activity-search");
    await userEvent.type(search, "sample");
    await userEvent.selectOptions(
      within(document.body).getByTestId("activity-status-filter"),
      "failed",
    );
  },
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
