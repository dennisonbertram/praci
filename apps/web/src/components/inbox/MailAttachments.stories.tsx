import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { withPageBehind } from "../../stories/decorators";
import { MailAttachments, PREVIEW_MAX_BYTES } from "./MailAttachments";

const attachments = [
  { id: "a1", filename: "Sample agreement.pdf", mimeType: "application/pdf", size: 220_000 },
  { id: "a2", filename: "site-photo.png", mimeType: "image/png", size: 40_000 },
  { id: "a3", filename: "budget.csv", mimeType: "text/csv", size: 1_200 },
  { id: "a4", filename: "notes.txt", mimeType: "text/plain", size: 300 },
  { id: "a5", filename: "archive.zip", mimeType: "application/zip", size: 5_000_000 },
  {
    id: "a6",
    filename: "raw-footage.pdf",
    mimeType: "application/pdf",
    size: PREVIEW_MAX_BYTES + 1,
  },
];

const text = (value: string) => new TextEncoder().encode(value);
const PDF =
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

async function png(): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 200;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#6b7280";
    context.fillRect(0, 0, 320, 200);
    context.fillStyle = "#e5e7eb";
    context.fillRect(40, 40, 240, 120);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await (blob?.arrayBuffer() ?? new ArrayBuffer(0)));
}

const rows = Array.from({ length: 6 }, (_, i) => ({
  row: i + 2,
  cells: [`Item ${i + 1}`, (i + 1) * 1200.5],
}));

function stub() {
  mockRpc({
    "dataRoom.emailImported": { files: [{ messageId: "msg_demo", attachmentId: "a4" }] },
    "dataRoom.importEmail": { imported: 1, duplicates: 0, failed: 0 },
    "files.spreadsheetPreview": {
      status: "ready",
      sheets: [{ name: "Budget", dimension: null }],
      sheet: "Budget",
      columns: ["A", "B"],
      headerRow: 1,
      header: ["Item", "Amount"],
      rows,
      truncated: false,
    },
  });
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes("/attachments/")) return original(input, init);
    const body = url.endsWith("/a1")
      ? text(PDF)
      : url.endsWith("/a2")
        ? await png()
        : text("Invented notes for the story.\nSecond line.");
    return new Response(body as BodyInit);
  };
  return () => {
    window.fetch = original;
  };
}

const meta = {
  title: "Inbox/Mail attachments",
  component: MailAttachments,
  args: { messageId: "msg_demo", attachments },
  decorators: [withPageBehind()],
  beforeEach: () => {
    setHideAmounts(false);
    return stub();
  },
  parameters: { docs: { description: { component: "Also shows: AttachmentView" } } },
} satisfies Meta<typeof MailAttachments>;
export default meta;
type Story = StoryObj<typeof meta>;

const openChip =
  (name: string): Story["play"] =>
  async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const chip = [...root.querySelectorAll("ul button")].find((b) => b.textContent?.includes(name));
    (chip as HTMLElement | undefined)?.click();
  };

/** Chips of one height; a small image shows its own thumbnail, other types a type icon. */
export const Chips: Story = {};
export const PdfPreview: Story = { play: openChip("Sample agreement") };
export const ImagePreview: Story = { play: openChip("site-photo") };
export const SheetPreview: Story = { play: openChip("budget.csv") };
export const TextPreview: Story = { play: openChip("notes.txt") };
export const NoPreview: Story = { play: openChip("archive.zip") };
export const TooLarge: Story = { play: openChip("raw-footage") };
