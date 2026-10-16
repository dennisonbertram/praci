import type { BillingStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../stories/fixtures-9";
import { SubscriptionGate } from "./SubscriptionGate";

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

const me = { billingEnabled: true };

// The capabilities lookup is cached for the page, so every story answers it the same way
// (billing on) and decides the outcome through the rpc mocks.
function stubCapabilities() {
  const original = window.fetch;
  window.fetch = async (input, init) =>
    String(input).includes("/api/auth/capabilities")
      ? new Response(
          JSON.stringify({
            sso: null,
            passwordAuth: true,
            passwordReset: false,
            resetUrl: null,
            billing: true,
          }),
          { headers: { "content-type": "application/json" } },
        )
      : original(input, init);
  return () => {
    window.fetch = original;
  };
}

const meta = {
  title: "Billing/SubscriptionGate",
  component: SubscriptionGate,
  parameters: { layout: "fullscreen" },
  args: {
    fallback: <div className="p-6 text-sm text-muted-foreground">Checking access</div>,
    children: <div className="p-6">Sample app content</div>,
  },
  beforeEach: stubCapabilities,
} satisfies Meta<typeof SubscriptionGate>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Checking: Story = {
  beforeEach: () => {
    mockRpc({ me: () => new Promise(() => undefined) });
  },
};

export const Open: Story = {
  beforeEach: () => {
    mockRpc({ me: { billingEnabled: false } });
  },
};

export const OpenWithSubscription: Story = {
  beforeEach: () => {
    mockRpc({ me, "billing.status": { ...status, access: true, state: "active" } });
  },
};

export const Paywall: Story = {
  beforeEach: () => {
    mockRpc({ me, "billing.status": status });
  },
};

export const LookupFails: Story = {
  beforeEach: () => {
    mockRpc({
      me,
      "billing.status": () => {
        throw new Error("Billing is unavailable");
      },
    });
  },
};
