import type { EquityOptionGrant } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { OptionGrantsTable } from "./OptionGrantsTable";

const schedule = (description: string): NonNullable<EquityOptionGrant["vestingSchedule"]> => ({
  id: `vesting-${description}`,
  startDate: "2025-01-06",
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  tranches: null,
  templateId: null,
  acceleratedShares: null,
  acceleratedOn: null,
  stoppedOn: null,
  description,
  createdAt: "2025-01-06T00:00:00.000Z",
  updatedAt: "2025-01-06T00:00:00.000Z",
});

const base: EquityOptionGrant = {
  id: "grant-1",
  label: "ES-40",
  stakeholderId: "sh-1",
  stakeholderName: "Ada Lovelace",
  planId: "plan-1",
  planName: "2026 Stock Plan",
  status: "outstanding",
  optionType: "iso",
  quantity: "120000",
  exercisePrice: "1.20",
  grantDate: "2025-03-04",
  exercisedQuantity: "0",
  canceledQuantity: "0",
  outstandingQuantity: "120000",
  vestedQuantity: "25000",
  vestingSchedule: schedule("1/48 monthly, 1 year cliff"),
  shareClassId: "sc-common",
  expirationDate: null,
  boardApprovedOn: null,
  postTerminationExerciseMonths: 3,
  earlyExercise: false,
  acceptanceStatus: "accepted",
  canceledOn: null,
  adminNotes: null,
  createdAt: "2025-03-04T00:00:00.000Z",
  updatedAt: "2025-03-04T00:00:00.000Z",
};

const grants: EquityOptionGrant[] = [
  base,
  {
    ...base,
    id: "grant-2",
    label: "ES-41",
    stakeholderId: "sh-2",
    stakeholderName: "Grace Hopper",
    planId: "plan-1",
    planName: "2026 Stock Plan",
    status: "outstanding",
    optionType: "nso",
    quantity: "48000",
    exercisePrice: "2.05",
    grantDate: "2024-11-18",
    exercisedQuantity: "8000",
    canceledQuantity: "0",
    outstandingQuantity: "40000",
    vestedQuantity: "24000",
    vestingSchedule: schedule("1/24 monthly, no cliff"),
    createdAt: "2024-11-18T00:00:00.000Z",
    updatedAt: "2024-11-18T00:00:00.000Z",
  },
  {
    ...base,
    id: "grant-3",
    label: "ES-42",
    stakeholderId: "sh-3",
    stakeholderName: "Katherine Johnson",
    planId: "plan-1",
    planName: "2026 Stock Plan",
    status: "canceled",
    optionType: "iso",
    quantity: "25000",
    exercisePrice: "0.85",
    grantDate: "2024-06-02",
    canceledOn: "2025-02-01",
    exercisedQuantity: "0",
    canceledQuantity: "25000",
    outstandingQuantity: "0",
    vestedQuantity: "0",
    vestingSchedule: schedule("1/48 monthly, no cliff"),
    createdAt: "2024-06-02T00:00:00.000Z",
    updatedAt: "2025-02-01T00:00:00.000Z",
  },
  {
    ...base,
    id: "grant-4",
    label: "ES-43",
    stakeholderId: "sh-4",
    stakeholderName: "Margaret Hamilton",
    planId: "plan-1",
    planName: "2026 Stock Plan",
    status: "forfeited",
    optionType: "nso",
    quantity: "36000",
    exercisePrice: "1.20",
    grantDate: "2023-09-25",
    exercisedQuantity: "0",
    canceledQuantity: "0",
    outstandingQuantity: "0",
    vestedQuantity: "0",
    vestingSchedule: null,
    createdAt: "2023-09-25T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
  },
];

const noop = () => undefined;

const meta = {
  title: "Cap table/Options",
  component: OptionGrantsTable,
  args: { onOpen: noop, onAction: noop, onDraft: noop },
  decorators: [
    (Story) => (
      <div className="w-full max-w-6xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OptionGrantsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Outstanding, canceled and forfeited grants in one ledger. */
export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.optionGrants.list": { items: grants, total: grants.length, page: 1, pageSize: 25 },
    }),
};

/** Nothing granted yet; the empty state offers the draft flow. */
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({ "equity.optionGrants.list": { items: [], total: 0, page: 1, pageSize: 25 } }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.optionGrants.list": () => new Promise<never>(() => undefined),
    }),
};

/** The server could not answer. */
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.optionGrants.list": () => {
        throw new Error("The option ledger is unavailable.");
      },
    }),
};
