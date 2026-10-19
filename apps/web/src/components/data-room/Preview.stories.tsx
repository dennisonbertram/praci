import type { Meta, StoryObj } from "@storybook/react-vite";
import { items, readyItem } from "../../stories/fixtures/data-room";
import { Preview } from "./Preview";

/** A one-page PDF with invented text; viewers rebuild a missing cross-reference table. */
const SAMPLE_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 76>>stream
BT /F1 24 Tf 72 700 Td (Sample agreement) Tj 0 -32 Td /F1 12 Tf (Example Co and Sample Ltd) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 6>>
%%EOF`;

/** Answers the file route with invented bytes (a PDF, or a drawn PNG) for the story. */
function serveFile(kind: "pdf" | "png") {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    if (!String(input).includes("/api/data-room/items/")) return original(input, init);
    if (kind === "pdf")
      return new Response(SAMPLE_PDF, { headers: { "content-type": "application/pdf" } });
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const context = canvas.getContext("2d");
    if (context) {
      const fill = context.createLinearGradient(0, 0, 400, 300);
      fill.addColorStop(0, "#d4d4d4");
      fill.addColorStop(1, "#525252");
      context.fillStyle = fill;
      context.fillRect(0, 0, 400, 300);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    return new Response(blob, { headers: { "content-type": "image/png" } });
  };
  return () => {
    window.fetch = original;
  };
}

const meta = {
  title: "DataRoom/Preview",
  component: Preview,
  // Beside the list the pane sits at the right edge; dragging its left edge widens it.
  decorators: [
    (Story) => (
      <div className="flex min-h-screen justify-end">
        <Story />
      </div>
    ),
  ],
  args: {
    item: readyItem,
    folderPath: "Contracts / Sample vendor",
    onAction: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Failed: Story = { args: { item: items[2] } };
/** A PDF is shown in the browser's own viewer above the summary; Open reads it in a new tab. */
export const Pdf: Story = {
  beforeEach: () => serveFile("pdf"),
  args: { item: { ...readyItem, name: "Sample agreement.pdf", mimeType: "application/pdf" } },
};
export const Image: Story = {
  beforeEach: () => serveFile("png"),
  args: { item: { ...readyItem, name: "Sample photo.png", mimeType: "image/png" } },
};
/** A type the browser cannot show keeps the file icon. */
export const OtherType: Story = {
  args: { item: { ...readyItem, name: "Sample budget.csv", mimeType: "text/csv" } },
};
/** Long names end in an ellipsis and show in full on hover. */
export const LongParty: Story = {
  args: {
    item: {
      ...readyItem,
      facets: {
        ...readyItem.facets,
        parties: ["The Example Mutual Insurance Company of Sampleland", "Sample Ltd"],
      },
    },
  },
};
/** Read while AI reading was off: no tags yet, and the preview says why. */
export const Untagged: Story = {
  args: {
    item: {
      ...readyItem,
      facets: { ...readyItem.facets, docType: null, docDate: null, parties: [], summary: null },
    },
  },
};
