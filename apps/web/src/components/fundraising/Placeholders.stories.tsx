import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  LegendValuePlaceholder,
  ProspectRowPlaceholder,
  RoundBarPlaceholder,
  SafeRowPlaceholder,
} from "./Placeholders";

const meta = {
  title: "Fundraising/Placeholders",
  decorators: [
    (Story) => (
      <div className="@container/bd w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Round: Story = {
  render: () => (
    <>
      <RoundBarPlaceholder />
      <div className="mt-3 w-40">
        <LegendValuePlaceholder />
      </div>
    </>
  ),
};

export const Prospects: Story = {
  render: () => (
    <ul>
      <ProspectRowPlaceholder />
      <ProspectRowPlaceholder />
    </ul>
  ),
};

export const Safes: Story = {
  render: () => (
    <ul>
      <SafeRowPlaceholder />
      <SafeRowPlaceholder />
    </ul>
  ),
};
