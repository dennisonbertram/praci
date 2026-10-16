import type { ActionApprovalRule } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../stories/rpc-mock-1";
import { ApprovalRulesSettings } from "./ApprovalRulesSettings";

const rules: ActionApprovalRule[] = [
  {
    id: "rule_1",
    effect: "require_approval",
    matchKind: "category",
    matchValue: "email",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_2",
    effect: "always_allow",
    matchKind: "connector",
    matchValue: "Sample connector",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_3",
    effect: "require_approval",
    matchKind: "tool",
    matchValue: "demo_tool",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_4",
    effect: "always_allow",
    matchKind: "category",
    matchValue: "calendar",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const meta = {
  title: "Settings/ApprovalRulesSettings",
  component: ApprovalRulesSettings,
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: { description: { component: "Also shows: describeRule (the rule sentences)." } },
  },
} satisfies Meta<typeof ApprovalRulesSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithRules: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.list": rules,
      "autoReview.get": { enabled: true, checkerAvailable: true },
      "approvalRules.set": (input: unknown) => ({
        id: "rule_new",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...(input as object),
      }),
      "approvalRules.remove": {},
    }),
};

export const NoRules: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.list": [],
      "autoReview.get": { enabled: false, checkerAvailable: true },
    }),
};

export const AutoReviewWithoutModel: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.list": [],
      "autoReview.get": { enabled: true, checkerAvailable: false },
    }),
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "approvalRules.list": () => new Promise(() => undefined), "autoReview.get": null }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.list": () => {
        throw new Error("The server did not answer.");
      },
    }),
};
