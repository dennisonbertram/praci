import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { AutoApprovalsList } from "./AutoApprovalsList";

const meta = {
  title: "Settings/AutoApprovalsList",
  component: AutoApprovalsList,
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AutoApprovalsList>;
export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  {
    id: "d1",
    tool: "mail_modify",
    botName: "Inbox",
    target: "Your weekly digest",
    at: "2026-01-02T08:00:00.000Z",
    undoable: true,
    undone: false,
  },
  {
    id: "d2",
    tool: "archive_bot",
    botName: "Scout",
    target: "Old helper",
    at: "2026-01-01T09:00:00.000Z",
    undoable: false,
    undone: true,
  },
  {
    id: "d3",
    tool: "page_edit",
    botName: "Ledger",
    target: "notes/plan.md",
    at: "2026-01-01T08:00:00.000Z",
    undoable: false,
    undone: false,
  },
];

export const Recent: Story = {
  beforeEach: () =>
    mockRpc({
      "autoReview.approvals": { rows },
      "autoReview.undo": { ok: true },
    }),
};

/** Nothing approved automatically yet: the list is not shown. */
export const Empty: Story = {
  beforeEach: () => mockRpc({ "autoReview.approvals": { rows: [] } }),
};

/** The list could not load: the error and Retry. */
export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "autoReview.approvals": () => {
        throw new Error("Could not load approvals");
      },
    }),
};

/** Undo failed: the error replaces Undo on that row; the list reloads. */
export const UndoError: Story = {
  beforeEach: () =>
    mockRpc({
      "autoReview.approvals": { rows },
      "autoReview.undo": () => {
        throw new Error("Could not undo");
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Undo" }));
  },
};
