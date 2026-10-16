import type { Bot, Ticket, TicketComment } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../stories/mock-rpc-5";
import { BoardPage } from "./Board";

const meta = {
  title: "Board/BoardPage",
  parameters: {
    docs: {
      description: {
        component: "Also shows: TicketDialog (opened from New ticket or a ticket card)",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const bot = (id: string, name: string) => ({ id, name }) as Bot;
const bots = [bot("bot_a", "Planner"), bot("bot_b", "Researcher")];

const ticket = (n: number, over: Partial<Ticket> = {}): Ticket => ({
  id: `t_${n}`,
  boardId: "board_1",
  spaceId: "space_1",
  number: n,
  ref: `DEMO-${n}`,
  title: `Sample ticket ${n}`,
  description: "A short description of the sample work.",
  status: "todo",
  priority: "normal",
  assigneeBotId: "bot_a",
  createdByBotId: null,
  createdByUserId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  ...over,
});

const tickets = [
  ticket(1),
  ticket(2, {
    status: "doing",
    assigneeBotId: "bot_b",
    title: "A much longer ticket title that wraps onto several lines in its column",
  }),
  ticket(3, { status: "done", priority: "high" }),
];

const comments: TicketComment[] = [
  {
    id: "c_1",
    ticketId: "t_1",
    body: "Started on this. **Two** open questions.",
    authorBotId: "bot_b",
    authorUserId: null,
    authorName: "Researcher",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

// Stays open like the live board stream, so the page does not retry in a loop.
const openStream = async function* () {
  await new Promise(() => undefined);
  yield undefined;
};

const mockBoard = (rows: Ticket[], owners: Bot[] = bots) =>
  mockRpc({
    "tickets.list": { tickets: rows },
    "bots.list": owners,
    "boards.subscribe": () => openStream(),
    "tickets.comments": comments,
  });

export const Empty: Story = { render: () => <BoardPage />, beforeEach: () => mockBoard([]) };

export const NoBots: Story = { render: () => <BoardPage />, beforeEach: () => mockBoard([], []) };

export const WithTickets: Story = {
  render: () => <BoardPage />,
  beforeEach: () => mockBoard(tickets),
};

export const LoadError: Story = {
  render: () => <BoardPage />,
  beforeEach: () =>
    mockRpc({
      "tickets.list": () => {
        throw new Error("offline");
      },
      "bots.list": bots,
      "boards.subscribe": () => openStream(),
    }),
};

export const NewTicketDialog: Story = {
  render: () => <BoardPage />,
  beforeEach: () => mockBoard(tickets),
  play: async ({ canvasElement }) => {
    const button = await within(canvasElement).findByRole("button", { name: "New ticket" });
    await within(canvasElement).findByTestId("board-card-t_1");
    await userEvent.click(button);
  },
};

export const EditTicketDialog: Story = {
  render: () => <BoardPage />,
  beforeEach: () => mockBoard(tickets),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByTestId("board-card-t_1"));
    await within(canvasElement.ownerDocument.body).findByTestId("ticket-comments");
  },
};
