import type { Meta, StoryObj } from "@storybook/react-vite";
import { items } from "../../stories/fixtures/data-room";
import { GridView, ListView, ResultsView, type RowInteraction } from "./ItemRows";

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
