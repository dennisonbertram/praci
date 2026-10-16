import type { Meta, StoryObj } from "@storybook/react-vite";
import { SerenitySettingsForm } from "./SerenitySettingsForm";

const meta = {
  title: "Settings/SerenitySettingsForm",
  component: SerenitySettingsForm,
  args: { busy: false, onConnect: async () => true },
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SerenitySettingsForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Busy: Story = { args: { busy: true } };
