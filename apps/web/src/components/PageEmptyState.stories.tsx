import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PieChart, Upload } from "lucide-react";
import { PageEmptyState } from "./PageEmptyState";

const meta = {
  title: "Pages/Page empty state",
  component: PageEmptyState,
  args: {
    icon: <PieChart className="size-8" aria-hidden="true" />,
    title: "No cap table yet",
    description: "Connect Carta to see shareholders, share classes and ownership.",
    children: <Button>Connect Carta</Button>,
  },
} satisfies Meta<typeof PageEmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {};

export const TwoActions: Story = {
  args: {
    icon: <Upload className="size-8" aria-hidden="true" />,
    title: "Data room",
    description: "Keep contracts, board decks and investor documents in one place.",
    children: (
      <>
        <Button>Choose files</Button>
        <Button variant="outline">New folder</Button>
      </>
    ),
  },
};

export const NoAction: Story = { args: { children: undefined } };
