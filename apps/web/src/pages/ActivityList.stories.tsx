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

/** Opens the filter form and its "More filters" fields. */
async function openFilters(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByTestId("activity-show-filters"));
  await userEvent.click(canvas.getByText("More filters"));
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
    const search = await within(canvasElement).findByTestId("activity-search");
    await userEvent.type(search, "zzz-no-match");
  },
};

export const WithFilterChips: Story = {
  beforeEach: () => mockRpc({ "runs.list": byFilter }),
  play: async ({ canvasElement }) => {
    await openFilters(canvasElement);
    const search = await within(canvasElement).findByTestId("activity-search");
    await userEvent.type(search, "sample");
    await userEvent.selectOptions(
      within(canvasElement).getByTestId("activity-status-filter"),
      "failed",
    );
  },
};
