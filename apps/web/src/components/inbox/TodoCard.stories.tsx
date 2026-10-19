import type { InboxTodo } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { TodoCard } from "./TodoCard";

/** YYYY-MM-DD for today plus `days`, in local time. */
function due(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todo(id: string, text: string, extra: Partial<InboxTodo> = {}): InboxTodo {
  return {
    id,
    connectionId: "conn_demo",
    messageId: null,
    text,
    detail: null,
    from: null,
    priority: null,
    dueOn: null,
    doneAt: null,
    ...extra,
  };
}

const todos: InboxTodo[] = [
  todo("t1", "Send the sample invoice", {
    from: "Sample Sender",
    detail: "Asked for a copy by Friday",
    dueOn: due(-1),
    priority: "critical",
  }),
  todo("t2", "Confirm the demo meeting", { dueOn: due(0), priority: "important" }),
  todo("t3", "Review the draft agreement", { dueOn: due(3) }),
  todo("t4", "Reply about the sample order", { dueOn: due(20) }),
  todo("t5", "Book the venue", { doneAt: "2026-01-01T00:00:00.000Z" }),
];

const meta = {
  title: "Inbox/TodoCard",
  component: TodoCard,
  args: { onChange: () => undefined },
  decorators: [
    (Story) => (
      <div className="@container w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodoCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { todos } };

/** Titles with a cached email open it. */
export const OpensEmail: Story = {
  args: {
    todos: todos.map((item) => ({ ...item, messageId: `msg_${item.id}` })),
    onOpen: () => undefined,
  },
};

export const SingleTodo: Story = { args: { todos: todos.slice(1, 2) } };

export const LongText: Story = {
  args: {
    todos: [
      todo(
        "t1",
        "Follow up on the long running sample thread about the quarterly planning agenda",
        {
          from: "A sender with a very long display name for the story",
          detail: "A long reason that explains why this item needs attention soon",
        },
      ),
    ],
  },
};

export const SaveFails: Story = {
  args: { todos },
  beforeEach: () => {
    mockRpc({
      "inbox.todos.setDone": () => {
        throw new Error("Could not save the to-do");
      },
    });
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("checkbox", { name: "Confirm the demo meeting" }),
    );
  },
};

/** Tick a to-do: it keeps its strike-through, fades, collapses, and leaves. Untick during the fade to keep it. */
export const TickToFade: Story = {
  args: { todos },
  beforeEach: () => {
    mockRpc({
      "inbox.todos.setDone": (input: unknown) => {
        const { id, done } = input as { id: string; done: boolean };
        return {
          ...(todos.find((item) => item.id === id) as InboxTodo),
          doneAt: done ? new Date().toISOString() : null,
        };
      },
    });
  },
  render: (args) => {
    const [items, setItems] = useState(args.todos);
    return (
      <TodoCard
        {...args}
        todos={items}
        onChange={(next) =>
          setItems((all) => all.map((item) => (item.id === next.id ? next : item)))
        }
      />
    );
  },
};
