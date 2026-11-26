import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { OptionGrantChangeDialog } from "./OptionGrantChangeDialog";
import { demoOptionGrant } from "./option-grant-fixture";

const grant = demoOptionGrant({
  vestingSchedule: {
    id: "vesting-1",
    templateId: null,
    startDate: "2025-01-06",
    totalMonths: 48,
    cliffMonths: 12,
    frequencyMonths: 1,
    tranches: null,
    acceleratedShares: null,
    acceleratedOn: null,
    stoppedOn: null,
    description: "1/48 monthly, 1 year cliff",
    createdAt: "2025-01-06T00:00:00.000Z",
    updatedAt: "2025-01-06T00:00:00.000Z",
  },
});

const meta = {
  title: "Cap table/Options/OptionGrantChangeDialog",
  component: OptionGrantChangeDialog,
  decorators: [withPageBehind()],
  args: { grant, action: "modifyGrant", onClose: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.optionGrants.update": grant,
      "equity.optionActions.terminate": { stakeholderId: "sh-1", terminatedOn: null, grants: [] },
    }),
} satisfies Meta<typeof OptionGrantChangeDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ModifyGrant: Story = {};
export const ModifyVesting: Story = { args: { action: "modifyVesting" } };
export const AccelerateVesting: Story = { args: { action: "accelerateVesting" } };
export const PostTerminationPeriod: Story = { args: { action: "modifyPostTermination" } };
export const AdminNotes: Story = { args: { action: "addAdminNotes" } };
export const Terminate: Story = { args: { action: "terminateStakeholder" } };
export const ReverseTermination: Story = { args: { action: "reverseTermination" } };
