import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { PageHeader, PageNavContext } from "./PageHeader";

const meta = {
  title: "Pages/Page header",
  component: PageHeader,
  args: { title: "Cap table" },
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithMeta: Story = {
  args: { meta: <span className="truncate">Example Co · Updated 5 minutes ago</span> },
};

export const WithActions: Story = {
  args: {
    meta: <span className="truncate">Example Co</span>,
    actions: (
      <>
        <Button variant="outline">Refresh</Button>
        <Button>
          <Plus aria-hidden="true" />
          Add contact
        </Button>
      </>
    ),
  },
};

export const LongTitle: Story = {
  args: {
    title: "A very long page title that has to give way before the actions do",
    actions: <Button>Add contact</Button>,
  },
};

export const NarrowWidth: Story = {
  args: {
    meta: (
      <span className="truncate">An example company with a very long name · Updated just now</span>
    ),
    actions: <Button>Add contact</Button>,
  },
  decorators: [
    (Story) => (
      <div className="w-[320px] px-4">
        <Story />
      </div>
    ),
  ],
};

export const Phone375: Story = {
  args: {
    meta: (
      <span className="truncate">An example company with a very long name · Updated just now</span>
    ),
    actions: (
      <>
        <Button variant="outline">Refresh</Button>
        <Button>Add contact</Button>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[343px]">
        <Story />
      </div>
    ),
  ],
};

/** Inside the shell on a phone the menu button leads the title row (hidden from 1024px up). */
export const PhoneWithMenu: Story = {
  args: Phone375.args,
  decorators: [
    (Story) => (
      <PageNavContext.Provider value={{ open: () => undefined, claim: () => () => undefined }}>
        <div className="w-[343px]">
          <Story />
        </div>
      </PageNavContext.Provider>
    ),
  ],
};
