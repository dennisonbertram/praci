import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
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

const emailFrame = [
  (Story: () => ReactElement) => (
    <div className="h-[30rem] w-[calc(100vw-2rem)] max-w-3xl overflow-hidden rounded-lg border border-border">
      <Story />
    </div>
  ),
];

export const Email: Story = { args: { html: staticHtml, email: true }, decorators: emailFrame };

const newsletter = `<h2 style="color:#0b5fff;margin:0 0 12px">Spring harvest is here</h2><p>Hello Sam,</p><p>The orchard opens on Saturday. Bring a basket, and see the <a href="https://example.com/visit">visiting hours</a>.</p><p>Warm regards,<br>Mira, Example Orchard</p><blockquote type="cite">On Mon, Sam wrote: Can we visit with a group?</blockquote><div style="text-align:center;color:#777;font-size:12px;margin-top:24px"><a href="https://example.com/unsubscribe">Unsubscribe</a> &middot; <a href="https://example.com/prefs">Manage preferences</a></div>`;

export const EmailNewsletter: Story = {
  args: { html: newsletter, email: true },
  decorators: emailFrame,
};

export const EmailPlain: Story = {
  args: { html: "<p>Lunch at noon? I booked the corner table.</p><p>Jo</p>", email: true },
  decorators: emailFrame,
};

export const EmailWideTable: Story = {
  args: {
    html: `<table width="1200" border="1" cellpadding="6"><tr><td>Invented report</td><td>Q1</td><td>Q2</td><td>Q3</td><td>Q4</td></tr></table><p>The table is wider than the frame.</p>`,
    email: true,
  },
  decorators: emailFrame,
};

const hugeImage = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="1500"><rect width="3000" height="1500" fill="#9bd"/></svg>')}`;

export const EmailHugeImage: Story = {
  args: {
    html: `<p>Photo from the trip:</p><img src="${hugeImage}" alt="Invented scenery">`,
    email: true,
  },
  decorators: emailFrame,
};

export const EmailNewsletterWithRemoteImages: Story = {
  args: {
    html: `<img src="cid:logo" width="120" height="40" alt=""><h2>Orchard weekly</h2><img src="/api/inbox/image?u=https%3A%2F%2Fexample.invalid%2Fbanner.png&s=u.s&t=stub" alt="Harvest banner"><img src="http://example.invalid/direct.png" alt="Direct link banner"><p>Apples, pears and plums are ready.</p><img src="/api/inbox/image?u=x&t=stub" width="1" height="1" alt=""><img src="data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><rect width="300" height="80" fill="#9bd"/></svg>')}" alt="Inline sample"><p style="text-align:center;font-size:12px"><a href="https://example.com/unsubscribe">Unsubscribe</a></p>`,
    email: true,
  },
  decorators: emailFrame,
};
