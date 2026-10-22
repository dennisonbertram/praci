import type { Meta, StoryObj } from "@storybook/react-vite";
import { overview } from "./fixtures";
import { GtmChannels } from "./GtmChannels";

const meta = { title: "GTM/Channels", component: GtmChannels, args: { overview } } satisfies Meta<
  typeof GtmChannels
>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
