import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddSidebarPage } from "./AddSidebarPage";

const team = {
  key: "team-health",
  label: "Team health",
  description: "Workload and key people, from your connected tools",
  route: "/app/team-health",
  platforms: ["web"],
  available: true,
} as const;

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
export const Closed: Story = {};
/** Every template is already added: the row is not shown. */
export const NothingLeftToAdd: Story = { args: { templates: [] } };
