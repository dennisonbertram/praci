import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppLogo } from "./AppLogo";

// An inline SVG keeps the image offline; it is not a real brand mark.
const sampleLogo = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#888"/></svg>',
)}`;

const meta = {
  title: "Integrations/AppLogo",
  component: AppLogo,
  args: { name: "Acme", logo: sampleLogo },
} satisfies Meta<typeof AppLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-3">
      {(["sm", "md", "lg", "xl"] as const).map((s) => (
        <AppLogo key={s} {...args} size={s} />
      ))}
    </div>
  ),
};

export const NoLogo: Story = { args: { logo: null } };

export const BrokenImage: Story = { args: { logo: "data:image/png;base64,broken" } };

export const EmptyName: Story = { args: { name: "  ", logo: null } };
