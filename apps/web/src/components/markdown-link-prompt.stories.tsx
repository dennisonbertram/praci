import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { MarkdownLinkPrompt } from "./markdown-link-prompt";

const meta = {
  title: "Chat/MarkdownLinkPrompt",
  component: MarkdownLinkPrompt,
  args: { children: null },
  render: () => (
    <MarkdownLinkPrompt>
      <ChatMarkdown>
        {"Read the [sample page](https://example.com/sample) for details."}
      </ChatMarkdown>
    </MarkdownLinkPrompt>
  ),
} satisfies Meta<typeof MarkdownLinkPrompt>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("sample page"));
    await within(document.body).findByText("Open external link?");
  },
};
