import type { Meta, StoryObj } from "@storybook/react-vite";
import { DevinSessions } from "./DevinSessions";
import { sessions } from "./fixtures";

const meta = {
  title: "Devin/Sessions",
  component: DevinSessions,
  args: { sessions },
} satisfies Meta<typeof DevinSessions>;
export default meta;

type Story = StoryObj<typeof meta>;
const inContainer = (width: string) => [
  (Story: () => React.ReactNode) => (
    <div className={`@container ${width}`}>
      <Story />
    </div>
  ),
];

/** A wide page: the table with fixed column widths. */
export const Wide: Story = { decorators: inContainer("w-[1000px]") };

/** A 600 px container is below `@2xl`: the compact list, with the Source column left out. */
export const Compact: Story = { decorators: inContainer("w-[600px]") };

/** A phone-width page. */
export const Phone: Story = { decorators: inContainer("w-[358px]") };

/** The connection is paused: cached rows and badges are muted. */
export const Muted: Story = { args: { muted: true }, decorators: inContainer("w-[1000px]") };

/** Only one section has rows, so the others are omitted. */
export const OneSection: Story = {
  args: { sessions: sessions.filter((s) => s.kind === "working") },
  decorators: inContainer("w-[1000px]"),
};
