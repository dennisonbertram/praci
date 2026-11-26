import type { Meta, StoryObj } from "@storybook/react-vite";
import { SeeAll, useCappedRows } from "./CappedList";

const names = [
  "Anchor Labs",
  "Birch Cloud",
  "Cedar Mail",
  "Delta Docs",
  "Ember Design",
  "Fjord Pay",
];

function Demo({ to }: { to?: string }) {
  const list = useCappedRows(names, { desktop: 5 });
  return (
    <div className="max-w-sm rounded-lg border border-border bg-card p-3 text-sm">
      <ul className="divide-y divide-border">
        {list.rows.map((name) => (
          <li key={name} className="py-1.5">
            {name}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-end">
        <SeeAll list={list} {...(to ? { to } : {})} />
      </div>
    </div>
  );
}

const meta = { title: "Components/CappedList", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Phone: 3 rows and a link to the full list. Wide: 5 rows, then it expands in place. */
export const WithFullPage: Story = { args: { to: "/app/example" } };
/** No full page: it expands in place on every width. */
export const ExpandsInPlace: Story = {};
