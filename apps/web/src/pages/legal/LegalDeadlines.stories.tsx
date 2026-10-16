import type { Meta, StoryObj } from "@storybook/react-vite";
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
