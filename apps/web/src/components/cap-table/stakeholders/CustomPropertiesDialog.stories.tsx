import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { CustomPropertiesDialog } from "./CustomPropertiesDialog";

const at = "2026-01-01T00:00:00.000Z";
const meta = {
  title: "Cap table/Stakeholders/Custom properties",
  component: CustomPropertiesDialog,
  decorators: [withPageBehind()],
  args: { open: true, onOpenChange: () => undefined, onChanged: () => undefined },
} satisfies Meta<typeof CustomPropertiesDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  beforeEach: () => mockRpc({ "equity.customProperties.list": [] }),
};

export const Three: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.customProperties.list": ["Office", "Team", "Start cohort"].map((name, index) => ({
        id: `cp-${index}`,
        name,
        hrisField: null,
        createdAt: at,
        updatedAt: at,
      })),
    }),
};
