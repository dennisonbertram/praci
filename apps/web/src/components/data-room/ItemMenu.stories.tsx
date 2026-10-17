import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { readyItem } from "../../stories/fixtures/data-room";
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
