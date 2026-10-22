import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PickFilter, SearchField, SortControl } from "./ListControls";

type Field = "name" | "shares" | "percent";
const fields: [Field, string][] = [
  ["name", "Name"],
  ["shares", "Shares"],
  ["percent", "Ownership"],
];

function Controls({ pick, anyLabel }: { pick?: string; anyLabel?: string }) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(pick);
  const [field, setField] = useState<Field>("percent");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-4">
      <SearchField
        className="w-full sm:w-72"
        value={query}
        onChange={setQuery}
        placeholder="Search"
        label="Search"
        name="story-search"
      />
      <PickFilter
        label="Security"
        anyLabel={anyLabel}
        value={value}
        options={[
          ["Common", "Common"],
          ["SAFE", "SAFE"],
        ]}
        onChange={setValue}
      />
      <div className="ms-auto flex items-center gap-0.5">
        <SortControl
          fields={fields}
          field={field}
          fieldLabel={fields.find(([name]) => name === field)?.[1] ?? ""}
          direction={direction}
          onField={setField}
          onDirection={setDirection}
        />
      </div>
    </div>
  );
}

const meta = { title: "Components/ListControls" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <Controls /> };
export const WithFilterSet: Story = { render: () => <Controls pick="SAFE" /> };
/** A filter whose menu starts with its unfiltered choice, selected by default. */
export const WithAnyChoice: Story = { render: () => <Controls anyLabel="Any security" /> };
