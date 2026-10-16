import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { SupermemorySettingsForm } from "./SupermemorySettingsForm";

const meta = {
  title: "Settings/Supermemory settings form",
  component: SupermemorySettingsForm,
  parameters: { layout: "padded" },
  args: { busy: false, onConnect: async () => true },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SupermemorySettingsForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Cloud: Story = {};

export const Local: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Local" }));
  },
};

export const ReadyToConnect: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByLabelText("Organization API key"),
      "sm_sample_key_123",
    );
  },
};

export const Busy: Story = { args: { busy: true } };
