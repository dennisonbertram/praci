import type { Meta, StoryObj } from "@storybook/react-vite";
import { SharedArtifactPage } from "./SharedArtifact";

const meta = {
  title: "Artifacts/SharedArtifactPage",
  component: SharedArtifactPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-[560px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SharedArtifactPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const stubFetch = (response: Response) => {
  const original = window.fetch;
  window.location.hash = "#example-token";
  window.fetch = async () => response;
  return () => {
    window.fetch = original;
    window.location.hash = "";
  };
};

/** A shared HTML page, drawn in the same isolated frame as the Artifacts preview. */
export const Html: Story = {
  beforeEach: () =>
    stubFetch(
      Response.json({
        name: "Sample dashboard.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>Sample dashboard</h1><p>Static demo page.</p>"),
      }),
    ),
};

/** A shared PDF is previewed in the page and can be saved by the recipient. */
export const Pdf: Story = {
  beforeEach: () =>
    stubFetch(
      Response.json({
        name: "Sample report.pdf",
        mimeType: "application/pdf",
        contentBase64: btoa("Sample PDF bytes"),
      }),
    ),
};

/** Unknown, expired and revoked links look the same. */
export const NotAvailable: Story = {
  beforeEach: () => stubFetch(Response.json({ error: "Not found" }, { status: 404 })),
};

/** Temporary server failures can be retried without changing the public link state. */
export const TemporaryFailure: Story = {
  beforeEach: () => {
    const original = window.fetch;
    window.location.hash = "#example-token";
    let failed = false;
    window.fetch = async () => {
      if (!failed) {
        failed = true;
        return Response.json({ error: "Temporary failure" }, { status: 500 });
      }
      return Response.json({
        name: "Sample dashboard.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>Recovered dashboard</h1>"),
      });
    };
    return () => {
      window.fetch = original;
      window.location.hash = "";
    };
  },
};
