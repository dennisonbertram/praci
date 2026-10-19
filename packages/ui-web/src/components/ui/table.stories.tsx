import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "./table";

const meta = { title: "UI/Table", component: Table } satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;

const dash = <span className="text-muted-foreground">—</span>;

const rows = [
  {
    id: "1",
    name: "Sample agreement",
    note: "Contracts / 2026",
    owner: "Alex Example",
    amount: 1200,
  },
  {
    id: "2",
    name: "A document with a much longer name than the column can show",
    note: "Reports",
    owner: "Jordan Sample, Riley Placeholder, Morgan Invented, Casey Fictional",
    amount: 48000,
  },
  { id: "3", name: "Untitled scan", note: "Inbox", owner: null, amount: null },
];

function Header() {
  return (
    <TableHeader>
      <TableHeadRow>
        <TableHead className="w-[45%]">Name</TableHead>
        <TableHead className="w-[35%]">Owner</TableHead>
        <TableHead className="w-24 text-end">Amount</TableHead>
        <TableHead className="w-7" />
      </TableHeadRow>
    </TableHeader>
  );
}

function Rows({ selected }: { selected?: string }) {
  return (
    <TableBody>
      {rows.map((r) => (
        <TableRow
          key={r.id}
          className="group/row"
          data-state={r.id === selected ? "selected" : undefined}
        >
          <TableCell>
            <div className="truncate font-medium" title={r.name}>
              {r.name}
            </div>
            <div className="truncate text-xs text-muted-foreground">{r.note}</div>
          </TableCell>
          <TableCell className="truncate" title={r.owner ?? undefined}>
            {r.owner ?? dash}
          </TableCell>
          <TableCell className="text-end tabular-nums">
            {r.amount == null ? dash : r.amount.toLocaleString("en")}
          </TableCell>
          <TableCell className="pe-0">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Actions"
              className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              ⋯
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export const Default: Story = {
  render: () => (
    <Table>
      <Header />
      <Rows />
    </Table>
  ),
};

export const SelectedRow: Story = {
  render: () => (
    <Table>
      <Header />
      <Rows selected="1" />
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <Table>
      <Header />
      <TableBody>
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="text-center text-muted-foreground">
            Nothing here yet
          </TableCell>
        </TableRow>
      </TableBody>
      <TableCaption className="sr-only">Empty</TableCaption>
    </Table>
  ),
};
