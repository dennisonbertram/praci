import type { RoutineHistory, RoutineRun } from "@rakazo/contracts";
import { PINNED_CONNECTION_LOST_MESSAGE } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { RoutineRunHistory } from "./RoutineRunHistory";

const run = (n: number, status: RoutineRun["status"], chat = true): RoutineRun => ({
  id: `run_${n}`,
  botId: "bot_demo",
  groupId: null,
  status,
  error: status === "failed" ? "504: request timed out" : null,
  createdAt: `2026-01-0${n}T09:00:00.000Z`,
  startedAt: `2026-01-0${n}T09:00:05.000Z`,
  completedAt: status === "completed" || status === "failed" ? `2026-01-0${n}T09:01:35.000Z` : null,
  messageId: chat ? `msg_${n}` : null,
  preview: chat ? "Cash is steady at the same level as last week." : null,
});

const history: RoutineHistory = {
  runs: [run(4, "completed"), run(3, "failed", false), run(2, "cancelled", false)],
  nextCursor: null,
};

const meta = {
  title: "Shell/Routine run history",
  component: RoutineRunHistory,
  args: { routineId: "routine_demo" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoutineRunHistory>;
export default meta;

type Story = StoryObj<typeof meta>;

const expand: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: /Run history/ }));
};

export const Collapsed: Story = { beforeEach: () => mockRpc({ "routines.history": history }) };

export const Expanded: Story = {
  beforeEach: () => mockRpc({ "routines.history": history }),
  play: expand,
};

/** A run that only asked another agent stays "Waiting on" it until that agent answers. */
export const WaitingOnAgent: Story = {
  beforeEach: () =>
    mockRpc({
      "routines.history": {
        ...history,
        runs: [{ ...run(4, "completed"), waitingOn: "Inbox agent" }, ...history.runs.slice(1)],
      },
    }),
  play: expand,
};

export const WithOlderRuns: Story = {
  beforeEach: () =>
    mockRpc({
      "routines.history": (input: unknown) =>
        (input as { before?: unknown }).before
          ? { runs: [run(1, "completed")], nextCursor: null }
          : { ...history, nextCursor: { id: "run_2", createdAt: "2026-01-02T09:00:00.000Z" } },
    }),
  play: async (context) => {
    await expand(context);
    await userEvent.click(
      await within(context.canvasElement).findByRole("button", { name: "Load older runs" }),
    );
  },
};

export const RefreshFailedWithOlderRuns: Story = {
  beforeEach: () => {
    let firstPageRequests = 0;
    return mockRpc({
      "routines.history": (input: unknown) => {
        if ((input as { before?: unknown }).before) {
          return { runs: [run(1, "completed")], nextCursor: null };
        }
        firstPageRequests += 1;
        if (firstPageRequests > 1) throw new Error("offline");
        return {
          ...history,
          nextCursor: { id: "run_2", createdAt: "2026-01-02T09:00:00.000Z" },
        };
      },
    });
  },
  play: async (context) => {
    await expand(context);
    await userEvent.click(
      await within(context.canvasElement).findByRole("button", { name: "Load older runs" }),
    );
    await userEvent.click(
      await within(context.canvasElement).findByRole("button", { name: "Refresh" }),
    );
    await within(context.canvasElement).findByRole("alert");
    await within(context.canvasElement).findAllByTestId("routine-run-row");
    expect(within(context.canvasElement).getAllByTestId("routine-run-row")).toHaveLength(4);
  },
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "routines.history": { runs: [], nextCursor: null } }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "routines.history": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "routines.history": () => {
        throw new Error("offline");
      },
    }),
};

/** The newest failed run offers its fix; the older identical failure stays text-only. */
export const NewestFailedWithFix: Story = {
  beforeEach: () =>
    mockRpc({
      "routines.history": {
        runs: [
          { ...run(5, "failed", false), error: PINNED_CONNECTION_LOST_MESSAGE },
          { ...run(4, "failed", false), error: PINNED_CONNECTION_LOST_MESSAGE },
          run(3, "completed"),
        ],
        nextCursor: null,
      },
    }),
  args: {
    onOpenModelSettings: () => undefined,
    onOpenBotSettings: () => undefined,
  },
  play: expand,
};

export const SilentRun: Story = {
  beforeEach: () =>
    mockRpc({
      "routines.history": {
        runs: [{ ...run(5, "completed", false), silent: true }, run(4, "completed")],
        nextCursor: null,
      },
    }),
  play: expand,
};
