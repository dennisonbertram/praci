import type { BillingStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { BillingSettingsPanel } from "./BillingSettingsPanel";

export const billing: BillingStatus = {
  access: true,
  canManage: true,
  trialAvailable: false,
  trialDays: 14,
  state: "active",
  price: { amount: 2000, currency: "usd", interval: "month", intervalCount: 1 },
  seats: 1,
  trialEndsAt: null,
  currentPeriodEndsAt: "2026-06-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  hasCustomer: true,
};

const meta = {
  title: "Settings/Billing panel",
  component: BillingSettingsPanel,
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "billing.status": billing }),
} satisfies Meta<typeof BillingSettingsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const ActiveManySeats: Story = {
  beforeEach: () => mockRpc({ "billing.status": { ...billing, seats: 5 } }),
};

export const Trial: Story = {
  beforeEach: () =>
    mockRpc({
      "billing.status": { ...billing, state: "trialing", trialEndsAt: "2026-02-01T00:00:00.000Z" },
    }),
};

export const PastDue: Story = {
  beforeEach: () => mockRpc({ "billing.status": { ...billing, state: "past_due" } }),
};

export const EndsAtPeriodEnd: Story = {
  beforeEach: () => mockRpc({ "billing.status": { ...billing, cancelAtPeriodEnd: true } }),
};

export const Canceled: Story = {
  beforeEach: () => mockRpc({ "billing.status": { ...billing, state: "canceled" } }),
};

export const Inactive: Story = {
  beforeEach: () =>
    mockRpc({
      "billing.status": {
        ...billing,
        state: "none",
        price: null,
        currentPeriodEndsAt: null,
        hasCustomer: false,
      },
    }),
};

/** Members cannot manage billing, so there is no Manage button. */
export const MemberView: Story = {
  beforeEach: () => mockRpc({ "billing.status": { ...billing, canManage: false } }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "billing.status": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () => mockRpc({ "billing.status": () => Promise.reject(new Error("offline")) }),
};
