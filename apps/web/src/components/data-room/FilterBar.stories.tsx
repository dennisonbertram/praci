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
}: {
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
    />
  );
}

const meta = { title: "DataRoom/FilterBar" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <Bar /> };
export const WithFilters: Story = {
  render: () => <Bar text="agreement" initial={{ docType: "Contract", party: "Example Co" }} />,
};
export const NothingToFilter: Story = { render: () => <Bar facets={false} /> };
