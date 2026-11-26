import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { HrisPreferencesDialog } from "./HrisPreferencesDialog";

const meta = {
  title: "Cap table/Stakeholders/Automation preferences",
  component: HrisPreferencesDialog,
  decorators: [withPageBehind()],
  args: { open: true, onOpenChange: () => undefined },
} satisfies Meta<typeof HrisPreferencesDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.hrisPreferences.get": { autoUpdates: false, autoFields: [], autoCreate: false },
    }),
};

export const On: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.hrisPreferences.get": {
        autoUpdates: true,
        autoFields: ["job_title", "department"],
        autoCreate: true,
      },
    }),
};
