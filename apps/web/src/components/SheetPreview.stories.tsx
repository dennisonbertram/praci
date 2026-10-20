import type { SpreadsheetPreview } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { SheetPreview } from "./SheetPreview";

type Cell = string | number | boolean | null;
type Input = { sheet?: string; offset?: number; limit?: number };

const REGIONS = ["North", "South", "East", "West"];
const NOTES = [
  "Renewal signed after the second review round with the customer's finance team",
  "New logo",
  "Upsell of the analytics add-on, billed annually",
  "",
];

// An invented workbook: revenue (many rows), headcount, a wide sheet and an empty one.
const revenue: Cell[][] = [
  ["Month", "Region", "Amount", "Booked on", "Notes", "Growth"],
  ...Array.from({ length: 250 }, (_, i): Cell[] => [
    `2025-${String((i % 12) + 1).padStart(2, "0")}`,
    REGIONS[i % 4] ?? null,
    12_500 + i * 1_837.25,
    `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    NOTES[i % 4] ?? null,
    `${(i % 9) + 1}.5%`,
  ]),
];
const headcount: Cell[][] = [
  ["Team", "People", "Open roles"],
  ["Engineering", 24, 3],
  ["Design", 6, 1],
  ["Sales", 11, 2],
];
const wide: Cell[][] = [
  Array.from({ length: 30 }, (_, c) => `Metric ${c + 1}`),
  ...Array.from({ length: 12 }, (_, r) =>
    Array.from({ length: 30 }, (_, c) => (r + 1) * (c + 1) * 100.5),
  ),
];
const sheets: Record<string, Cell[][]> = {
  Revenue: revenue,
  Headcount: headcount,
  Wide: wide,
  Empty: [],
};

const letters = (n: number) =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)));

function workbook(input: Input): SpreadsheetPreview {
  const name = input.sheet ?? "Revenue";
  const data = sheets[name] ?? [];
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 200;
  const [header = [], ...body] = data;
  const page = body.slice(offset, offset + limit);
  return {
    status: "ready",
    sheets: Object.keys(sheets).map((entry) => ({ name: entry, dimension: null })),
    sheet: name,
    columns: letters(header.length),
    headerRow: data.length ? 1 : null,
    header,
    rows: page.map((cells, i) => ({ row: offset + i + 2, cells })),
    truncated: offset + limit < body.length,
  };
}

const meta = {
  title: "Files/SheetPreview",
  component: SheetPreview,
  args: { source: { artifactId: "sheet-1" } },
  decorators: [
    (Story) => (
      <div className="h-[520px] max-w-[960px] overflow-hidden rounded-2xl border border-border">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    setHideAmounts(false);
    mockRpc({ "files.spreadsheetPreview": workbook });
  },
} satisfies Meta<typeof SheetPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Several sheets, numbers right-aligned, dates formatted, long notes cut with a hover tooltip, and Load more. */
export const Workbook: Story = {};

export const AmountsHidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    mockRpc({ "files.spreadsheetPreview": workbook });
    return () => setHideAmounts(false);
  },
};

export const SingleSheet: Story = {
  beforeEach: () => {
    mockRpc({
      "files.spreadsheetPreview": () => ({
        ...workbook({ sheet: "Headcount" }),
        sheets: [{ name: "Headcount", dimension: "A1:C4" }],
      }),
    });
  },
};

export const WideSheet: Story = {
  beforeEach: () => {
    mockRpc({
      "files.spreadsheetPreview": (input: Input) =>
        workbook({ ...input, sheet: input.sheet ?? "Wide" }),
    });
  },
};

export const EmptySheet: Story = {
  beforeEach: () => {
    mockRpc({
      "files.spreadsheetPreview": (input: Input) =>
        workbook({ ...input, sheet: input.sheet ?? "Empty" }),
    });
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mockRpc({ "files.spreadsheetPreview": () => new Promise(() => {}) });
  },
};

export const Unsupported: Story = {
  beforeEach: () => {
    mockRpc({
      "files.spreadsheetPreview": () => ({ status: "unsupported", message: "Legacy .xls" }),
    });
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockRpc({
      "files.spreadsheetPreview": () => {
        throw new Error("Could not read the file.");
      },
    });
  },
};
