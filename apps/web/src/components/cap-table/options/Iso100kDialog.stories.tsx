import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { Iso100kDialog } from "./Iso100kDialog";
import { demoOptionGrant } from "./option-grant-fixture";

const schedule = (startDate: string) => ({
  id: "vesting-1",
  templateId: null,
  startDate,
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  tranches: null,
  acceleratedShares: null,
  acceleratedOn: null,
  stoppedOn: null,
  description: "1/48 monthly, 1 year cliff",
  createdAt: `${startDate}T00:00:00.000Z`,
  updatedAt: `${startDate}T00:00:00.000Z`,
});

const page = (items: ReturnType<typeof demoOptionGrant>[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 500,
});

const meta = {
  title: "Cap table/Options/Iso100kDialog",
  component: Iso100kDialog,
  decorators: [withPageBehind()],
  args: { onClose: () => {} },
} satisfies Meta<typeof Iso100kDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

const grants = [
  demoOptionGrant({
    id: "grant-1",
    label: "ES-40",
    stakeholderId: "sh-1",
    stakeholderName: "Ada Example",
    exercisePrice: "0.10",
    grantDate: "2024-01-01",
    vestingSchedule: schedule("2024-01-01"),
  }),
  demoOptionGrant({
    id: "grant-2",
    label: "ES-41",
    stakeholderId: "sh-2",
    stakeholderName: "Grace Example",
    quantity: "200000",
    exercisePrice: "1",
    grantDate: "2025-06-01",
    earlyExercise: true,
    vestingSchedule: null,
  }),
];

export const WithGrants: Story = {
  beforeEach: () => mockRpc({ "equity.optionGrants.list": page(grants) }),
};

export const NoIsoGrants: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.optionGrants.list": page([
        demoOptionGrant({ optionType: "nso", stakeholderName: "Bo Example" }),
      ]),
    }),
};
