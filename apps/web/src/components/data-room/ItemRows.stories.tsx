import type { Meta, StoryObj } from "@storybook/react-vite";
import { items } from "../../stories/fixtures/data-room";
import { GridView, ListView, ResultsView, type RowInteraction, SubfolderList } from "./ItemRows";

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
/** Nothing classified yet: the facet columns give their width to the name. */
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
export const Grid: Story = { render: () => <GridView rows={rows} o={o} /> };
export const Results: Story = { render: () => <ResultsView rows={hits} o={o} /> };
/** A phone-width list: long names wrap to a second line and each row names its folder. */
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
  { id: "fld_inv", name: "Invoices", parentId: "fld_fin", createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "fld_rec", name: "Receipts", parentId: "fld_fin", createdAt: "2026-10-01T00:00:00.000Z" },
];
/** The grid of an open folder with sub-folders: they are tiles too, above the files. */
export const GridWithSubfolders: Story = {
  render: () => (
    <>
      <SubfolderList tiles folders={subfolders} onOpen={() => undefined} />
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
      lead={
        <SubfolderList
          folders={[
            {
              id: "fld_inv",
              name: "Invoices",
              parentId: "fld_fin",
              createdAt: "2026-10-01T00:00:00.000Z",
            },
            {
              id: "fld_rec",
              name: "Receipts",
              parentId: "fld_fin",
              createdAt: "2026-10-01T00:00:00.000Z",
            },
          ]}
          onOpen={() => undefined}
        />
      }
    />
  ),
};
