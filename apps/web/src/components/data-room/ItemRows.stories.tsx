import type { Meta, StoryObj } from "@storybook/react-vite";
import { items } from "../../stories/fixtures/data-room";
import { GridView, ListView, type RowInteraction, SubfolderList } from "./ItemRows";

const o: RowInteraction = {
  shownId: "itm_ready",
  onSelect: () => undefined,
  onToggle: () => undefined,
  onAction: () => undefined,
  folderPath: (id) => (id ? "Contracts / Sample vendor" : ""),
};
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
