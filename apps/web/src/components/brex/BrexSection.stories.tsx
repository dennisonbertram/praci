import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrexSection } from "./BrexSection";

const meta = {
  title: "Brex/Section",
  component: BrexSection,
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexSection>;
export default meta;
type Story = StoryObj<typeof meta>;

const retry = () => {};

export const Loading: Story = {
  args: { query: { data: null, error: "", retry }, children: () => null },
};

export const ErrorState: Story = {
  args: {
    query: { data: null, error: "Brex did not answer.", retry },
    children: () => null,
  },
};

export const Ready: Story = {
  args: {
    query: { data: { rows: 3 }, error: "", retry },
    children: (data) => <p>{JSON.stringify(data)}</p>,
  },
};

export const TokenRejected: Story = {
  args: {
    query: { data: null, error: "Brex rejected this token", code: "BREX_TOKEN_REJECTED", retry },
    children: () => null,
  },
};
