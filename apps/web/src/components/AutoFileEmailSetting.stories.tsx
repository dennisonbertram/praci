import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { AutoFileEmailSetting } from "./AutoFileEmailSetting";

const meta = {
  title: "Settings/AutoFileEmailSetting",
  component: AutoFileEmailSetting,
  decorators: [
    (Story) => (
      <div className="w-[480px] rounded-xl border border-border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AutoFileEmailSetting>;
export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {
  beforeEach: () =>
    mockRpc({
      "models.autoFileEmail": { enabled: true },
      "models.setAutoFileEmail": (input: unknown) => input,
    }),
};

export const Off: Story = {
  beforeEach: () =>
    mockRpc({
      "models.autoFileEmail": { enabled: false },
      "models.setAutoFileEmail": (input: unknown) => input,
    }),
};
