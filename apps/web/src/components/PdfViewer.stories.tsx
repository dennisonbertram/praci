import type { Meta, StoryObj } from "@storybook/react-vite";
import { PdfViewer } from "./PdfViewer";

// A one-page PDF with the words "Sample" drawn on it, built from plain text.
const pdf = new TextEncoder().encode(
  [
    "%PDF-1.1",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    "4 0 obj<</Length 44>>stream",
    "BT /F1 24 Tf 40 100 Td (Sample) Tj ET",
    "endstream endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R/Size 6>>",
    "%%EOF",
  ].join("\n"),
);

const meta = {
  title: "Chat/PdfViewer",
  component: PdfViewer,
  args: { bytes: pdf, title: "Sample document" },
  decorators: [
    (Story) => (
      <div className="h-80 w-[480px] border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PdfViewer>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
