import type { Meta, StoryObj } from "@storybook/react-vite";
import { I18nBootstrap } from "./I18nBootstrap";

const meta = {
  title: "Shell/I18n bootstrap",
  component: I18nBootstrap,
  args: {
    children: <p className="p-4 text-sm">App content, shown once the locale catalog is ready.</p>,
  },
} satisfies Meta<typeof I18nBootstrap>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The preview already loaded the catalog, so this renders the children straight away. */
export const Ready: Story = {};
