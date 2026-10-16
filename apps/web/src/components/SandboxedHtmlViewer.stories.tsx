import type { Meta, StoryObj } from "@storybook/react-vite";
import { SandboxedHtmlViewer } from "./SandboxedHtmlViewer";

const html = `<body style="font-family:sans-serif;padding:16px"><h2>Quarterly note</h2><p>Plain content with a <a href="https://example.com">link</a>.</p><button id="b">Run script</button><script>document.getElementById("b").onclick=function(){this.textContent="clicked"}</script></body>`;

const meta = {
  title: "Chat/SandboxedHtmlViewer",
  component: SandboxedHtmlViewer,
  args: { html, title: "Preview" },
  decorators: [
    (Story) => (
      <div className="h-64 w-96 border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SandboxedHtmlViewer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const staticHtml = `<body style="font-family:sans-serif;padding:16px"><h2>Quarterly note</h2><p>Plain content with a <a href="https://example.com">link</a>.</p></body>`;

export const WithoutScripts: Story = { args: { html: staticHtml, scripts: false } };

export const Email: Story = { args: { html: staticHtml, email: true } };
