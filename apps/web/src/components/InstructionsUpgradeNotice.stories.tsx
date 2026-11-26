import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { makeBot } from "../stories/fixtures";
import { InstructionsUpgradeDialog, InstructionsUpgradeNotice } from "./InstructionsUpgradeNotice";

const current = "You help with finance questions. Keep answers short.";
const next =
  "You are the Finance agent. Answer questions about accounts, cards and statements from the connected tools. Keep answers short and cite the account.";
const long = Array.from({ length: 30 }, (_, i) => `Rule ${i + 1}: keep this example line.`).join(
  "\n",
);

const meta = {
  title: "Components/InstructionsUpgradeNotice",
  component: InstructionsUpgradeNotice,
  args: { botId: "bot-1", instructions: current, onUpgraded: fn() },
  decorators: [
    (Story) => (
      <div className="w-[560px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "bots.instructionsUpgrade": { current, next } }),
} satisfies Meta<typeof InstructionsUpgradeNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Nothing: Story = {
  beforeEach: () => mockRpc({ "bots.instructionsUpgrade": null }),
};

const dialogArgs = {
  upgrade: { current, next },
  busy: false,
  error: null,
  onUpgrade: fn(),
  onKeep: fn(),
  onClose: fn(),
};

export const Dialog: StoryObj<typeof InstructionsUpgradeDialog> = {
  render: (args) => <InstructionsUpgradeDialog {...args} />,
  args: dialogArgs,
};

export const LongPrompts: StoryObj<typeof InstructionsUpgradeDialog> = {
  render: (args) => <InstructionsUpgradeDialog {...args} />,
  args: { ...dialogArgs, upgrade: { current: long, next: long } },
};

export const Upgrading: StoryObj<typeof InstructionsUpgradeDialog> = {
  render: (args) => <InstructionsUpgradeDialog {...args} />,
  args: { ...dialogArgs, busy: true },
};

export const ConflictError: StoryObj<typeof InstructionsUpgradeDialog> = {
  render: (args) => <InstructionsUpgradeDialog {...args} />,
  args: { ...dialogArgs, error: "The instructions changed; review them again" },
};

/** Review opens the dialog from the notice; Upgrade hands the updated agent back. */
export const FullFlow: Story = {
  beforeEach: () =>
    mockRpc({
      "bots.instructionsUpgrade": { current, next },
      "bots.upgradeInstructions": makeBot({ instructions: next }),
    }),
};
