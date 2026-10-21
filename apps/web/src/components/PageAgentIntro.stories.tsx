import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PageAgentIntro } from "./PageAgentIntro";

const meta = {
  title: "Shell/Page agent intro",
  component: PageAgentIntro,
  args: { kind: "inbox", onAsk: fn() },
  decorators: [
    (Story) => (
      <div className="flex h-[420px] w-[370px] flex-col border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageAgentIntro>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Inbox agent before the first message. */
export const Inbox: Story = {};
/** The Finance agent before the first message. */
export const Finance: Story = { args: { kind: "finance" } };
/** The Carta agent before the first message. */
export const Carta: Story = { args: { kind: "carta" } };
/** The Data room agent before the first message. */
export const DataRoom: Story = { args: { kind: "data-room" } };
/** The Legal agent before the first message. */
export const Legal: Story = { args: { kind: "legal" } };

export const Investors: Story = { args: { kind: "investors" } };
