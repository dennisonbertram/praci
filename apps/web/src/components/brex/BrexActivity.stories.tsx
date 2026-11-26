import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexActivity } from "./BrexActivity";
import { activityFixture, emptyActivityFixture } from "./fixtures";

const meta = {
  title: "Brex/Activity",
  component: BrexActivity,
  parameters: { initialEntries: ["/app/brex/activity"] },
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexActivity>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  beforeEach: () => mockRpc({ "brexCards.activity": activityFixture }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.activity": emptyActivityFixture }),
};
