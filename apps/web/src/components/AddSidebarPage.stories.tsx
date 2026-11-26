import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddSidebarPage } from "./AddSidebarPage";

const team = {
  key: "team-health",
  route: "/app/team-health",
  platforms: ["web"],
  available: true,
} as const;

const bots = [
  {
    bot: { id: "bot_fin", name: "Finance agent", color: "#4f6f9f" },
    pages: [
      { id: "p1", title: "Cash" },
      { id: "p2", title: "Burn" },
    ],
  },
  {
    bot: { id: "bot_gtm", name: "Growth agent", color: "#9f6f4f" },
    pages: [{ id: "p3", title: "Pipeline" }],
  },
];

const meta = {
  title: "Shell/Add sidebar page",
  component: AddSidebarPage,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex h-48 w-72 flex-col">
        <Story />
      </div>
    ),
  ],
  args: { templates: [team], onAdd: () => {} },
} satisfies Meta<typeof AddSidebarPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MenuOpen: Story = { args: { defaultOpen: true } };
/** Templates, then each bot's pages. */
export const MenuWithBotPages: Story = {
  args: { defaultOpen: true, botPages: bots },
  decorators: [
    (Story) => (
      <div className="h-96">
        <Story />
      </div>
    ),
  ],
};
/** Only bot pages are left. */
export const OnlyBotPages: Story = { args: { defaultOpen: true, templates: [], botPages: bots } };
export const Closed: Story = {};
/** Every template is already added: the row is not shown. */
export const NothingLeftToAdd: Story = { args: { templates: [] } };
