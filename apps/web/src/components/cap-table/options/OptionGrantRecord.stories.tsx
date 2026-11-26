import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { OptionGrantRecord } from "./OptionGrantRecord";
import { demoOptionGrant } from "./option-grant-fixture";

const meta = {
  title: "Cap table/Options/OptionGrantRecord",
  component: OptionGrantRecord,
  decorators: [withPageBehind()],
  args: {
    onClose: () => {},
    grant: demoOptionGrant({
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
    }),
  },
} satisfies Meta<typeof OptionGrantRecord>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithVesting: Story = {};
export const NoVesting: Story = { args: { grant: demoOptionGrant() } };
