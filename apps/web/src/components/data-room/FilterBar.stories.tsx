import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { folders } from "../../stories/fixtures/data-room";
import { FilterBar } from "./FilterBar";
import { folderNodes } from "./folders";
import type { Filters, Sort } from "./use-data-room-list";

function Bar({
  initial = {},
  text = "",
  facets = true,
  stats = false,
}: {
  /** The Stats view: no search or Sort, yet the Filters button and pills keep their places. */
  stats?: boolean;
  initial?: Filters;
  text?: string;
  /** False: the items have no type, party, date or second source yet, so those filters hide. */
  facets?: boolean;
}) {
  const [query, setQuery] = useState(text);
  const [filters, setFilters] = useState<Filters>(initial);
  const [sort, setSort] = useState<Sort | null>({ field: "createdAt", direction: "desc" });
  return (
    <FilterBar
      query={query}
      onQuery={setQuery}
      searching={query !== ""}
      filters={filters}
      onFilters={setFilters}
      sort={sort}
      onSort={setSort}
      types={facets ? ["Contract", "Invoice"] : []}
      parties={facets ? ["Example Co", "Sample Ltd"] : []}
      sources={facets ? ["upload", "gmail"] : ["upload"]}
      hasDates={facets}
      folders={folderNodes(folders)}
      folderId={filters.folderId}
      onFolder={(folderId) => setFilters({ ...filters, folderId })}
      onNewFolder={() => undefined}
      onAutoSort={() => undefined}
      statsView={stats}
      trailing={
        <fieldset className="m-0 flex gap-0.5 border-0 p-0">
          {[0, 1, 2].map((n) => (
            <span key={n} className="inline-block size-7 rounded-md border border-border" />
          ))}
        </fieldset>
      }
    />
  );
}

/** The page body is a `@container/bd`; these are its widths at a 1024 and a 375 window. */
const inBody = (width: number, stats = false) => (
  <div className="@container/bd" style={{ width }}>
    <Bar stats={stats} />
  </div>
);

const meta = { title: "DataRoom/FilterBar" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <Bar /> };
export const WithFilters: Story = {
  render: () => <Bar text="agreement" initial={{ docType: "Contract", party: "Example Co" }} />,
};
export const NothingToFilter: Story = { render: () => <Bar facets={false} /> };
export const Body784: Story = { render: () => inBody(784) };
export const Body343: Story = { render: () => inBody(375) };
/** The same places as Body343 and Default, with search and Sort left out. */
export const Stats343: Story = { render: () => inBody(375, true) };
export const Stats1440: Story = { render: () => inBody(1100, true) };
export const List1440: Story = { render: () => inBody(1100) };
