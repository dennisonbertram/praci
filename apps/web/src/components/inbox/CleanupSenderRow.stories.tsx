import type { CleanupSender } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CleanupSenderRow } from "./CleanupSenderRow";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const sender: CleanupSender = {
  connectionId: "conn_demo",
  address: "news@lists.example.test",
  name: "Northwind Weekly",
  messageCount: 24,
  readCount: 1,
  lastReceivedAt: daysAgo(2),
  inboxThreads: 18,
  preselected: true,
  spamLike: false,
  unsubscribe: "one_click",
  skipInbox: false,
  unsubscribeStatus: null,
};

const meta = {
  title: "Inbox/CleanupSenderRow",
  component: CleanupSenderRow,
  args: { sender, checked: false, onToggle: () => undefined },
  decorators: [
    (Story) => (
      <div className="@container w-[640px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CleanupSenderRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A bulk, rarely read sender starts ticked. */
export const Preselected: Story = { args: { checked: true } };

/** Future mail is archived during sync; Stop forgets the decision. */
export const Skipping: Story = {
  args: { sender: { ...sender, skipInbox: true }, onStop: () => undefined },
};

/** Gmail also keeps the sender's mail out of the inbox. Nothing extra is shown. */
export const RuleActive: Story = {
  args: { sender: { ...sender, skipInbox: true, rule: "active" }, onStop: () => undefined },
};

/** Skipped in Praci, but Gmail's 1,000 filter limit is used up. */
export const RuleFull: Story = {
  args: { sender: { ...sender, skipInbox: true, rule: "full" }, onStop: () => undefined },
};

/** Skipped in Praci, but Gmail did not accept the filter. */
export const RuleFailed: Story = {
  args: { sender: { ...sender, skipInbox: true, rule: "failed" }, onStop: () => undefined },
};

/** The model kept putting this sender in Newsletters, so its mail goes there on its own; Forget undoes that. */
export const Learned: Story = {
  args: { sender: { ...sender, learnedPile: "newsletters" }, onForgetLearned: () => undefined },
};

/** Never ticked, and Skip inbox and Unsubscribe leave it out. */
export const LooksLikeSpam: Story = {
  args: {
    sender: {
      ...sender,
      name: "Quick Prize",
      address: "win@promo.example.test",
      spamLike: true,
      unsubscribe: "refused",
      preselected: false,
    },
  },
};

/** The list covers more than one account, so each row names its account. */
export const TwoAccounts: Story = { args: { accountLabel: "Work" } };

export const Disabled: Story = { args: { checked: true, disabled: true } };
