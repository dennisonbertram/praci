import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContactRowPlaceholder, FiguresPlaceholder, OwnershipPlaceholder } from "./Placeholders";

const meta = {
  title: "Investors/Placeholders",
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

/** Static skeletons for the empty Cap table: figures, ownership bar and legend. */
export const CapTable: Story = {
  render: () => (
    <>
      <FiguresPlaceholder />
      <OwnershipPlaceholder />
    </>
  ),
};

export const Contacts: Story = {
  render: () => (
    <ul>
      {[0, 1, 2].map((n) => (
        <ContactRowPlaceholder key={n} />
      ))}
    </ul>
  ),
};
