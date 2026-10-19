import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { UserTextBubble } from "./UserTextBubble";

const meta = {
  title: "Chat/UserTextBubble",
  component: UserTextBubble,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="w-96">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof UserTextBubble>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { text: "Please summarise the open points." } };

/** A file sent from the Data room shows as a chip under the message, not as a raw id line. */
export const WithDataRoomFile: Story = {
  args: { text: "Summarise this\n\nData room item itm_1: Sample agreement.pdf" },
};

export const OnlyFiles: Story = {
  args: {
    text: "Data room item itm_1: Sample agreement.pdf\nData room item itm_2: Sample budget.xlsx",
  },
};
