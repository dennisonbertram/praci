import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { LinkFavicons } from "./markdown.web";
import { ChatMarkdown, LinkFaviconsContext, LinkifiedText } from "./markdown.web";

const icon =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="#888"/></svg>',
  );
// A 4x4 gray PNG, so the embedded-image path draws something.
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEAQMAAACTPww9AAAAA1BMVEWAgIC8Z6mhAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==";

const favicons: LinkFavicons = {
  endpoint: "story",
  load: async () => ({ icon }),
};

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="w-[560px] max-w-full">{children}</div>
);

const meta = {
  title: "Chat/Markdown",
  component: ChatMarkdown,
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: CodeBlock, ExternalLinkUrl, ExternalLinkAlert, ConfirmableAnchor, RemoteImageButton, MarkdownImage, LinkedRemoteImage, LinkFavicon, WebsiteLink, MarkdownAnchor",
      },
    },
  },
} satisfies Meta<typeof ChatMarkdown>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children:
      "# Sample notes\n\nSome **bold**, _italic_ and `inline code` text.\n\n- First item\n- Second item\n\n> A quoted line.",
  },
};

export const Streaming: Story = {
  args: {
    streaming: true,
    children: "The reply is still arriving and has an open fence:\n\n```ts\nconst a = 1",
  },
};

export const WithCodeBlock: Story = {
  args: { children: "```ts\nexport const total = (a: number, b: number) => a + b;\n```" },
};

export const WithLinks: Story = {
  decorators: [
    (Story) => (
      <LinkFaviconsContext.Provider value={favicons}>
        <Story />
      </LinkFaviconsContext.Provider>
    ),
  ],
  args: {
    children:
      "See [the sample docs](https://docs.example.com/guide) or https://example.com/a/very/long/path/to/a/sample/page.\n\nA [mail link](mailto:demo@example.test) and a [broken link](javascript:alert(1)).",
  },
};

/** Clicking an external link asks first (ExternalLinkAlert, ExternalLinkUrl). */
export const ExternalLinkConfirm: Story = {
  args: { children: "Open [the sample docs](https://docs.example.com/guide)." },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("link"));
    await expect(await within(document.body).findByText("Open external link?")).toBeTruthy();
  },
};

export const WithEmbeddedImage: Story = {
  args: { children: `Inline image: ![A gray square](${pixel})` },
};

/** A remote image waits for a tap (RemoteImageButton). */
export const WithRemoteImage: Story = {
  args: { children: "![Sample chart](https://images.example.test/chart.png)" },
};

/** A remote image that is also a link (LinkedRemoteImage). */
export const WithLinkedRemoteImage: Story = {
  args: {
    children: "[![Sample badge](https://images.example.test/badge.png)](https://example.com/build)",
  },
};

/** Plain text with URLs in it (LinkifiedText). */
export const Linkified: StoryObj = {
  render: () => (
    <Frame>
      <LinkFaviconsContext.Provider value={favicons}>
        <p>
          <LinkifiedText>
            {
              "Docs are at https://docs.example.com/guide and the status page is https://status.example.com."
            }
          </LinkifiedText>
        </p>
      </LinkFaviconsContext.Provider>
    </Frame>
  ),
};
