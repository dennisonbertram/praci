import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArtifactPreview } from "./ArtifactPreview";

const encode = (value: string) => new TextEncoder().encode(value);

const meta = {
  title: "Chat/Artifact preview",
  component: ArtifactPreview,
  decorators: [
    (Story) => (
      <div className="h-[360px] w-[560px] overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
  args: {
    artifact: { id: "artifact_demo", name: "report.md", mimeType: "text/markdown" },
    bytes: encode("# Sample report\n\nInvented **content** for a preview.\n\n- One\n- Two"),
  },
  parameters: { docs: { description: { component: "Also shows: ImagePreview" } } },
} satisfies Meta<typeof ArtifactPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Markdown: Story = {};

export const Html: Story = {
  args: {
    artifact: { id: "artifact_demo", name: "page.html", mimeType: "text/html" },
    bytes: encode("<h1>Sample page</h1><p>Invented HTML content.</p>"),
  },
};

export const Unsupported: Story = {
  args: {
    artifact: { id: "artifact_demo", name: "data.zip", mimeType: "application/zip" },
    bytes: new Uint8Array(),
  },
};
