import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { AvatarStudioPopover, type AvatarStudioPopoverProps } from "./avatar-studio-popover";

function Controlled(props: AvatarStudioPopoverProps) {
  const [value, setValue] = useState(props.value);
  return <AvatarStudioPopover {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Shell/Avatar studio",
  component: AvatarStudioPopover,
  args: { value: "#6A6BF5", identity: "bot_demo", status: "idle", onChange: () => undefined },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof AvatarStudioPopover>;
export default meta;

type Story = StoryObj<typeof meta>;

const openStudio: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByTestId("avatar-studio-trigger"));
};

export const Closed: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const OpenOnDefaultLook: Story = { play: openStudio };

export const OpenWithShapeSelected: Story = {
  args: { value: "#D9508A::shape_2" },
  play: openStudio,
};

export const OpenOnUploadTab: Story = {
  play: async (context) => {
    await openStudio(context);
    await userEvent.click(await within(document.body).findByRole("button", { name: "Upload" }));
  },
};
