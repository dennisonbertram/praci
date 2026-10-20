import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { items } from "../../stories/fixtures/data-room";
import { GridView, ListView, type RowInteraction, SubfolderList } from "./ItemRows";

const o: RowInteraction = {
  shownId: "itm_ready",
  onSelect: () => undefined,
  onToggle: () => undefined,
  onAction: () => undefined,
  folderPath: (id) => (id ? "Contracts / Sample vendor" : ""),
  agents: [
    { id: "bot_ada", name: "Ada", color: "#6366f1" },
    { id: "bot_ben", name: "Ben", color: "#10b981" },
    { id: "bot_cy", name: "Cy", color: "#f59e0b" },
  ],
  onSendToAgent: () => undefined,
};

/** Right-clicks the first file and opens the Send to agent submenu. */
async function openSendToAgent(canvasElement: HTMLElement) {
  const row = canvasElement.querySelector("[data-row]");
  row?.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 160, clientY: 60 }),
  );
  const menu = within(document.body);
  await userEvent.click(await menu.findByRole("menuitem", { name: "Send to agent" }));
}
const rows = items.map((item) => ({ item, snippets: [] as string[] }));
const hits = rows.slice(0, 2).map((row) => ({
  ...row,
  snippets: ["the \u0001sample\u0002 agreement renews yearly"],
}));

const meta = {
  title: "DataRoom/ItemRows",
  decorators: [
    (Story) => (
      <div className="@container/list w-[720px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const List: Story = { render: () => <ListView rows={rows} o={o} /> };
/** Nothing classified yet: every column keeps its place, with a dash where a value is missing. */
export const ListWithoutFacets: Story = {
  render: () => (
    <ListView
      rows={rows.map(({ item }) => ({
        item: { ...item, facets: { ...item.facets, docType: null, docDate: null, parties: [] } },
        snippets: [],
      }))}
      o={o}
    />
  ),
};
/** Sorted by document date: the Date column is headed "Document date" and shows that date. */
export const ListByDocumentDate: Story = {
  render: () => <ListView rows={rows} o={o} sortField="date" />,
};
/** A file being read and a failed one: Status is its own column, and the failed row offers Try again. */
export const ListWithStatus: Story = {
  render: () => (
    <ListView
      rows={rows.map((row, index) => ({
        ...row,
        item: {
          ...row.item,
          ...(index === 0 ? { status: "processing" as const } : {}),
          ...(index === 1
            ? { status: "failed" as const, error: "This file isn't a readable PDF." }
            : {}),
        },
      }))}
      o={o}
    />
  ),
};
export const Grid: Story = { render: () => <GridView rows={rows} o={o} /> };
/** Search results: the same rows, with the text that matched under each. */
export const Results: Story = { render: () => <ListView rows={hits} o={o} /> };
/** Read while AI reading was off: the Type column says so instead of staying blank. */
export const ListWithUntagged: Story = {
  render: () => (
    <ListView
      rows={rows.map((row, index) =>
        index === 0
          ? { ...row, item: { ...row.item, facets: { ...row.item.facets, docType: null } } }
          : row,
      )}
      o={o}
    />
  ),
};
/** Grid with an untagged file: its tile says "Not tagged"; type and date have a line each. */
export const GridWithUntagged: Story = {
  render: () => (
    <GridView
      rows={rows.map((row, index) =>
        index === 0
          ? { ...row, item: { ...row.item, facets: { ...row.item.facets, docType: null } } }
          : row,
      )}
      o={o}
    />
  ),
};
/**
 * A phone-width list: long names wrap to a second line, each row names its folder, and the type
 * and date go under the name.
 */
export const ListNarrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/list w-[358px]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ListView
      rows={rows.map(({ item }, index) => ({
        item:
          index === 0
            ? { ...item, name: "Sample Master Services Agreement - Example Logistics Holdings.pdf" }
            : item,
        snippets: [],
      }))}
      o={o}
    />
  ),
};
const subfolders = [
  {
    id: "fld_inv",
    name: "Invoices",
    parentId: "fld_fin",
    createdAt: "2026-10-01T00:00:00.000Z",
    itemCount: 2,
  },
  { id: "fld_rec", name: "Receipts", parentId: "fld_fin", createdAt: "2026-10-01T00:00:00.000Z" },
];
/** The grid of an open folder with sub-folders: they are tiles too, above the files. */
export const GridWithSubfolders: Story = {
  render: () => (
    <>
      <SubfolderList
        contents={(folder) => (folder.itemCount ? `${folder.itemCount} items` : "Empty")}
        tiles
        folders={subfolders}
        onOpen={() => undefined}
        onAction={() => undefined}
      />
      <GridView rows={rows} o={o} />
    </>
  ),
};
/** An open folder with sub-folders: they come first, under the column header. */
export const ListWithSubfolders: Story = {
  render: () => (
    <ListView
      rows={rows}
      o={o}
      lead={() => (
        <SubfolderList
          contents={(folder) => (folder.itemCount ? `${folder.itemCount} items` : "Empty")}
          folders={[
            {
              id: "fld_inv",
              name: "Invoices",
              parentId: "fld_fin",
              createdAt: "2026-10-01T00:00:00.000Z",
              itemCount: 2,
            },
            {
              id: "fld_rec",
              name: "Receipts",
              parentId: "fld_fin",
              createdAt: "2026-10-01T00:00:00.000Z",
            },
          ]}
          onOpen={() => undefined}
          onAction={() => undefined}
        />
      )}
    />
  ),
};

const SHEET_TEXT = [
  "Line item\tQuarter\tCost",
  "Sample hosting\tQ1\t$12,400.00",
  "Example support\tQ1\t$3,150.00",
  "Placeholder licences\tQ2\t$8,000.00",
  "Sample travel\tQ2\t$1,925.00",
  "Example training\tQ3\t$2,300.00",
  "Placeholder total\tFY\t$27,775.00",
  "Sample note\tQ4\t$900.00",
  "Example misc\tQ4\t$450.00",
].join("\n");
const DOC_TEXT =
  "Sample services memo. This memo describes invented work for Example Co and Sample Ltd. " +
  "The parties agree that the fee is $4,500.00 per month, payable on the first day of each month. " +
  "Either party may end the arrangement with thirty days of written notice. This text is made up.";

/** Draws a page-like picture (lines of text) or a gradient, as the thumbnail route would return it. */
function drawThumbnail(kind: "page" | "photo") {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = kind === "page" ? 414 : 240;
  const context = canvas.getContext("2d");
  if (context) {
    if (kind === "page") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 320, 414);
      context.fillStyle = "#262626";
      context.font = "bold 22px sans-serif";
      context.fillText("Sample agreement", 30, 52);
      context.fillStyle = "#a3a3a3";
      for (let y = 90; y < 380; y += 22) context.fillRect(30, y, y % 3 ? 260 : 200, 8);
    } else {
      const fill = context.createLinearGradient(0, 0, 320, 240);
      fill.addColorStop(0, "#d4d4d4");
      fill.addColorStop(1, "#525252");
      context.fillStyle = fill;
      context.fillRect(0, 0, 320, 240);
    }
  }
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
}

/** Answers the thumbnail route with invented pictures: item ids starting "itm_photo" get a photo. */
function serveThumbnails() {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes("/thumbnail")) return original(input, init);
    const blob = await drawThumbnail(url.includes("itm_photo") ? "photo" : "page");
    return new Response(blob, { headers: { "content-type": "image/png" } });
  };
  return () => {
    window.fetch = original;
  };
}

const base = items[0]!;
const previewRows = [
  { ...base, id: "itm_pdf", name: "Sample agreement.pdf", mimeType: "application/pdf" },
  { ...base, id: "itm_photo", name: "Sample photo.png", mimeType: "image/png", size: 4000 },
  {
    ...base,
    id: "itm_sheet",
    name: "Sample budget.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    previewText: SHEET_TEXT,
  },
  {
    ...base,
    id: "itm_doc",
    name: "Sample memo.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    previewText: DOC_TEXT,
  },
  { ...base, id: "itm_bare", name: "Scanned sample.pdf", mimeType: "application/pdf" },
  { ...base, id: "itm_old", name: "Legacy sample.doc", mimeType: "application/msword" },
].map((item) => ({
  item: { ...item, hasThumbnail: item.id === "itm_pdf" || item.id === "itm_photo" },
  snippets: [] as string[],
}));

/** PDF and image tiles show a drawn thumbnail, sheets and documents the start of their text; the rest keep the icon. */
export const GridWithPreviews: Story = {
  beforeEach: () => {
    setHideAmounts(false);
    return serveThumbnails();
  },
  render: () => <GridView rows={previewRows} o={o} />,
};
/** Amounts hidden: thumbnails give way to the icon and amounts in the text previews are masked. */
export const GridWithPreviewsAmountsHidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    const stop = serveThumbnails();
    return () => {
      stop();
      setHideAmounts(false);
    };
  },
  render: () => <GridView rows={previewRows} o={o} />,
};
/** A phone-width grid of previews: two tiles per row. */
export const GridWithPreviewsNarrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/list w-[358px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    setHideAmounts(false);
    return serveThumbnails();
  },
  render: () => <GridView rows={previewRows} o={o} />,
};
/** Right-click a row: the menu offers Send to agent, with the user's agents, recent first. */
export const ListContextMenu: Story = {
  render: () => <ListView rows={rows} o={o} />,
  play: ({ canvasElement }) => openSendToAgent(canvasElement),
};
export const GridContextMenu: Story = {
  render: () => <GridView rows={rows} o={o} />,
  play: ({ canvasElement }) => openSendToAgent(canvasElement),
};
