import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { useState } from "react";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { deadlines } from "./fixtures";
import { LegalDeadlines } from "./LegalDeadlines";

const meta = {
  title: "Legal/Deadlines",
  component: LegalDeadlines,
  // Fixed "today" so the overdue badge does not depend on the day the story is viewed.
  args: { deadlines, onChanged: () => {}, today: "2026-10-16" },
  beforeEach: () => mockRpc({ "legal.updateDeadline": null }),
} satisfies Meta<typeof LegalDeadlines>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { deadlines: [] } };

/** Opened from the Overdue tile: only the overdue ones, with a way back to all. */
export const OnlyOverdue: Story = { args: { onlyOverdue: true, onShowAll: () => {} } };

/** The page offers the Legal agent: each row gets Ask agent with the row as the question. */
export const WithAskAgent: Story = { args: { onAsk: () => {} } };

function ReloadingDeadlines(args: ComponentProps<typeof LegalDeadlines>) {
  const [rows, setRows] = useState(args.deadlines);
  // Like the page: a reload lists open deadlines only, and an Undo brings the row back.
  const onChanged = () =>
    setRows((now) => (now.length === args.deadlines.length ? now.slice(1) : args.deadlines));
  return <LegalDeadlines {...args} deadlines={rows} onChanged={onChanged} />;
}

/** The page reloads after Done and the list no longer holds the row: its place shows the Undo line. */
export const DoneWithReload: Story = { render: (args) => <ReloadingDeadlines {...args} /> };

/** A scan found a deadline that may no longer apply: it stays open with Keep; Dismiss confirms. */
export const RemovalProposed: Story = {
  args: { deadlines: deadlines.map((d, i) => ({ ...d, removalProposed: i === 1 })) },
};
