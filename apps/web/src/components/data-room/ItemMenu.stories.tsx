import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { failedItem, readyItem } from "../../stories/fixtures/data-room";
import { ItemMenu } from "./ItemMenu";

const meta = {
  title: "DataRoom/ItemMenu",
  render: () => <ItemMenu item={readyItem} onAction={() => undefined} />,
} satisfies Meta;
export default meta;

export const Closed: StoryObj = {};

export const Open: StoryObj = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button"));
  },
};

/** A file that could not be read leads with Try again. */
export const FailedOpen: StoryObj = {
  render: () => <ItemMenu item={failedItem} onAction={() => undefined} canRetry />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button"));
  },
};
