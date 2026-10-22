import type { Meta, StoryObj } from "@storybook/react-vite";
import { overview } from "./fixtures";
import { GtmChannels } from "./GtmChannels";

const meta = { title: "GTM/Channels", component: GtmChannels, args: { overview } } satisfies Meta<
  typeof GtmChannels
>;
export default meta;
export const Default: StoryObj<typeof meta> = {};

/** Two mailboxes: each address sits on its own line, so none breaks mid-word. */
export const TwoMailboxes: StoryObj<typeof meta> = {
  args: {
    overview: {
      ...overview,
      gmailAccounts: [
        {
          connectionId: "conn_1",
          address: "founder@northwind.example.test",
          label: "Founder mail",
        },
        { connectionId: "conn_2", address: "sales@northwind.example.test", label: "Sales mail" },
      ],
    },
  },
};
