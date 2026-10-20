import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ArtifactFileCard } from "./ArtifactFileCard";

const text = (value: string) => ({ contentBase64: btoa(value) });
const markdown = text(
  "# Sample report\n\nThis is **invented** content for a preview.\n\n- One\n- Two",
);
const html = text("<h1>Sample page</h1><p>Invented HTML content.</p>");

const meta = {
  title: "Chat/Artifact file card",
  component: ArtifactFileCard,
  args: {
    target: { botId: "bot_demo" },
    artifactId: "artifact_demo",
    name: "report.md",
    mimeType: "text/markdown",
    size: 2048,
  },
  beforeEach: () => mockRpc({ "artifacts.get": markdown }),
  parameters: { docs: { description: { component: "Also shows: FilePreview, DownloadError" } } },
} satisfies Meta<typeof ArtifactFileCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Markdown: Story = {};

export const Html: Story = {
  args: { name: "page.html", mimeType: "text/html", size: 512 },
  beforeEach: () => mockRpc({ "artifacts.get": html }),
};

export const Pdf: Story = {
  args: { name: "invoice.pdf", mimeType: "application/pdf", size: 52_000 },
};

export const OtherFile: Story = {
  args: { name: "data.zip", mimeType: "application/zip", size: 4_500_000 },
};

export const Csv: Story = {
  args: { name: "forecast.csv", mimeType: "text/csv", size: 3_200 },
};

export const LongName: Story = {
  args: {
    name: "a-very-long-sample-file-name-that-keeps-going-and-going-for-the-quarterly-summary.md",
  },
};

/** The preview dialog loads the file, then renders it. */
export const PreviewOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Preview report.md"));
    await expect(await within(document.body).findByText("Sample report")).toBeTruthy();
  },
};

export const PreviewLoading: Story = {
  beforeEach: () => mockRpc({ "artifacts.get": () => new Promise(() => undefined) }),
  play: PreviewOpen.play,
};

export const PreviewError: Story = {
  beforeEach: () =>
    mockRpc({
      "artifacts.get": () => {
        throw new Error("Could not load this file.");
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Preview report.md"));
    await within(document.body).findByText("Could not load this file.");
  },
};

export const PreviewNotText: Story = {
  beforeEach: () => mockRpc({ "artifacts.get": { contentBase64: btoa("\xff\xfe\xfd") } }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Preview report.md"));
    await within(document.body).findByText("This file is not valid UTF-8 text.");
  },
};

/** A failed download from the card shows an inline alert. */
export const DownloadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "artifacts.get": () => {
        throw new Error("offline");
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Download report.md"));
    await within(canvasElement).findByRole("alert");
  },
};

export const OtherFileDownloadFailed: Story = {
  ...DownloadFailed,
  args: { name: "data.zip", mimeType: "application/zip", size: 4_500_000 },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("data.zip"));
    await within(canvasElement).findByRole("alert");
  },
};
