import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="flex h-40 items-center justify-center">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const demo = (text: string, side?: "top" | "bottom" | "left" | "right") => (
  <Tooltip>
    <TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger>
    <TooltipContent side={side}>{text}</TooltipContent>
  </Tooltip>
);

/** Closed until hovered. */
export const Default: Story = { render: () => demo("A short hint") };

export const Open: Story = {
  render: () => demo("A short hint"),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("button"));
    await expect(await within(document.body).findByText("A short hint")).toBeTruthy();
  },
};

export const Bottom: Story = {
  render: () => demo("Shown below the trigger", "bottom"),
  play: Open.play,
};

export const LongText: Story = {
  render: () =>
    demo(
      "A longer hint that has to wrap because the tooltip is limited to a maximum width of about twenty rem.",
    ),
  play: Open.play,
};

export const OpenByDefault: Story = {
  render: () => (
    <Tooltip open>
      <TooltipTrigger render={<Button variant="outline" />}>Always open</TooltipTrigger>
      <TooltipContent>Controlled open</TooltipContent>
    </Tooltip>
  ),
};
