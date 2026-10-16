import type { BillingStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaywallPage } from "./Paywall";

const status: BillingStatus = {
  access: false,
  canManage: true,
  trialAvailable: true,
  trialDays: 14,
  state: "none",
  price: { amount: 2000, currency: "usd", interval: "month", intervalCount: 1 },
  seats: 1,
  trialEndsAt: null,
  currentPeriodEndsAt: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
};

const meta = {
  title: "Auth/Paywall",
  component: PaywallPage,
  parameters: { layout: "fullscreen" },
  args: { status },
} satisfies Meta<typeof PaywallPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TrialAvailable: Story = {};

export const Subscribe: Story = { args: { status: { ...status, trialAvailable: false } } };

export const PastDueWithPortal: Story = {
  args: { status: { ...status, trialAvailable: false, state: "past_due", hasCustomer: true } },
};

/** Members cannot subscribe; they can only log out. */
export const MemberView: Story = { args: { status: { ...status, canManage: false } } };
