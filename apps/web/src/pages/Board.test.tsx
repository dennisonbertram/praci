// @vitest-environment jsdom

import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";
import { act, createContext, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  boards: { subscribe: vi.fn() },
  bots: { list: vi.fn() },
  tickets: {
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    comment: vi.fn(),
    comments: vi.fn(),
    move: vi.fn(),
  },
}));
vi.mock("../lib/rpc", () => ({ rpc: api }));
vi.mock("../lib/relative-time", () => ({ formatRelativeTime: () => "5m ago" }));
vi.mock("./WindowChrome", () => ({ WindowChrome: () => null }));
vi.mock("../components/ListControls", () => ({
  SearchField: ({
    value,
    onChange,
    label,
    name,
  }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    name: string;
  }) => (
    <input
      type="search"
      aria-label={label}
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  PickFilter: ({
    value,
    onChange,
    label,
    options,
  }: {
    value?: string;
    onChange: (value: string | undefined) => void;
    label: string;
    options: [string, string][];
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">All</option>
        {options.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  ),
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + String(values[index] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children?: ReactNode }) => (
    <div data-testid="chat-markdown">{children}</div>
  ),
}));
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const MenuContext = createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    trigger: RefObject<HTMLButtonElement | null>;
  } | null>(null);
  const DropdownMenu = ({ children }: { children?: ReactNode }) => {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
      if (!open) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);
    return (
      <MenuContext.Provider value={{ open, setOpen, trigger }}>{children}</MenuContext.Provider>
    );
  };
  const DropdownMenuTrigger = ({
    children,
    render,
  }: {
    children: ReactNode;
    render: ReactElement<ComponentProps<"button">>;
  }) => {
    const context = useContext(MenuContext)!;
    return (
      <button
        {...render.props}
        ref={context.trigger}
        type="button"
        onClick={() => context.setOpen(!context.open)}
        onKeyDown={(event) => {
          render.props.onKeyDown?.(event);
          if (event.key === "Enter" || event.key === " ") context.setOpen(true);
        }}
      >
        {children}
      </button>
    );
  };
  const DropdownMenuContent = ({ children }: { children?: ReactNode }) => {
    const context = useContext(MenuContext)!;
    return context.open ? <div>{children}</div> : null;
  };
  const DropdownMenuItem = ({ children, onClick }: ComponentProps<"button">) => {
    const context = useContext(MenuContext)!;
    return (
      <button
        type="button"
        onClick={(event) => {
          onClick?.(event);
          context.setOpen(false);
        }}
      >
        {children}
      </button>
    );
  };
  return {
    Button: (props: ComponentProps<"button">) => <button {...props} />,
    Dialog: Container,
    DialogContent: Container,
    DialogHeader: Container,
    DialogTitle: Container,
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  };
});

import { BoardPage } from "./Board";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function bot(id: string, name: string) {
  return { id, name };
}

function ticket(
  title: string,
  id: string,
  status = "todo",
  ref = "RAK-1",
  assigneeBotId: string | null = null,
  description: string | null = null,
) {
  return {
    id,
    boardId: "board-1",
    spaceId: "space-1",
    number: 1,
    ref,
    title,
    description,
    status,
    priority: "normal",
    assigneeBotId,
    createdByBotId: null,
    createdByUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

async function renderBoard(
  stream?: AsyncIterable<{ ticketId?: string }>,
  embedded = false,
  initialEntry = "/app/board",
) {
  api.boards.subscribe.mockReset();
  api.boards.subscribe.mockResolvedValue(
    stream ?? {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }),
    },
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <BoardPage embedded={embedded} />
      </MemoryRouter>,
    ),
  );
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

it("searches ticket titles and keeps the query in the URL", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({
    tickets: [ticket("Ship the release", "ticket-1"), ticket("Write docs", "ticket-2")],
  });
  const page = await renderBoard();
  try {
    const search = page.container.querySelector('input[name="board-search"]');
    expect(search).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        search!,
        "release",
      );
      search!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(page.container.querySelector('[data-testid="board-card-ticket-1"]')).not.toBeNull();
    expect(page.container.querySelector('[data-testid="board-card-ticket-2"]')).toBeNull();
    expect(page.container.querySelector('[data-testid="location-search"]')?.textContent).toBe(
      "?q=release",
    );
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("filters tickets to unassigned owners", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({
    tickets: [
      ticket("No owner", "ticket-1"),
      ticket("Owned", "ticket-2", "todo", "RAK-2", "bot-1"),
    ],
  });
  const page = await renderBoard();
  try {
    const owner = page.container.querySelector(
      'select[aria-label="Owner"]',
    ) as HTMLSelectElement | null;
    expect(owner).not.toBeNull();
    await act(async () => {
      owner!.value = "unassigned";
      owner!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(page.container.querySelector('[data-testid="board-card-ticket-1"]')).not.toBeNull();
    expect(page.container.querySelector('[data-testid="board-card-ticket-2"]')).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("does not show the empty explainer while the first ticket load is pending", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resolveTickets!: (value: { tickets: ReturnType<typeof ticket>[] }) => void;
  api.bots.list.mockResolvedValue([]);
  api.tickets.list.mockReturnValue(
    new Promise((resolve) => {
      resolveTickets = resolve;
    }),
  );
  const page = await renderBoard();
  try {
    expect(page.container.querySelector("main")?.hasAttribute("hidden")).toBe(true);
    await act(async () => resolveTickets({ tickets: [] }));
    expect(page.container.querySelector("main")?.hasAttribute("hidden")).toBe(false);
    expect(page.container.textContent).toContain("No tickets yet");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("does not replace a newer ticket list with an older response", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resolveOlder!: (value: { tickets: ReturnType<typeof ticket>[] }) => void;
  let resolveNewer!: (value: { tickets: ReturnType<typeof ticket>[] }) => void;
  api.bots.list.mockResolvedValue([]);
  api.tickets.list
    .mockReset()
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOlder = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNewer = resolve;
      }),
    );
  const page = await renderBoard();
  try {
    await act(async () => resolveNewer({ tickets: [ticket("Newer result", "newer")] }));
    await act(async () => resolveOlder({ tickets: [ticket("Older result", "older")] }));
    expect(page.container.textContent).toContain("Newer result");
    expect(page.container.textContent).not.toContain("Older result");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("drops its own Back button inside the app shell, which keeps the sidebar", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([]);
  api.tickets.list.mockResolvedValue({ tickets: [] });
  const standalone = await renderBoard();
  expect(standalone.container.querySelector("[aria-label='Back']")).not.toBeNull();
  await standalone.cleanup();
  const embedded = await renderBoard(undefined, true);
  try {
    expect(embedded.container.querySelector("[aria-label='Back']")).toBeNull();
    expect(embedded.container.textContent).toContain("Task board");
  } finally {
    await embedded.cleanup();
    vi.unstubAllGlobals();
  }
});

it("renders status columns and opens a ticket with comments", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({
    tickets: [ticket("Ship", "ticket-1", "todo", "RAK-1", "bot-1", "Details")],
  });
  api.tickets.comments.mockResolvedValue([
    {
      id: "comment-1",
      body: "Ready",
      authorName: "Board tester",
      createdAt: "2026-10-10T10:00:00Z",
    },
    { id: "comment-2", body: "Reviewed", authorName: "Helper", createdAt: "2026-10-10T10:01:00Z" },
  ]);
  const page = await renderBoard();
  try {
    expect(
      Array.from(page.container.querySelectorAll("h2")).map((node) => node.textContent),
    ).toEqual(["To do", "In progress", "In review", "Blocked", "Done", "Won't do"]);
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    expect(page.container.querySelector('[data-testid="ticket-description"]')?.textContent).toBe(
      "Details",
    );
    expect(page.container.querySelector('[data-testid="ticket-comments"]')?.textContent).toContain(
      "Ready",
    );
    const comments = page.container.querySelector('[data-testid="ticket-comments"]')!;
    expect(comments.textContent).toContain("Board tester");
    expect(comments.textContent).toContain("Helper");
    expect(Array.from(comments.querySelectorAll("time")).map((node) => node.textContent)).toEqual([
      "5m ago",
      "5m ago",
    ]);
    expect(
      Array.from(page.container.querySelectorAll("form select")).every(
        (node) => node.className === "w-full",
      ),
    ).toBe(true);
    const submitButtons = page.container.querySelectorAll('button[type="submit"]');
    expect(Array.from(submitButtons).map((node) => node.parentElement?.className)).toEqual([
      "flex justify-end",
      "flex justify-end",
    ]);
    expect(api.tickets.comments).toHaveBeenCalledWith({ ticketId: "ticket-1" });
  } finally {
    await page.cleanup();
  }
});

it("shows the priority on a card only for high and urgent", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({
    tickets: [
      { ...ticket("A", "t-urgent", "todo", "RAK-4"), priority: "urgent" },
      { ...ticket("B", "t-high", "todo", "RAK-5"), priority: "high" },
      ticket("C", "t-normal", "todo", "RAK-6"),
      { ...ticket("D", "t-low", "todo", "RAK-7"), priority: "low" },
    ],
  });
  const page = await renderBoard();
  try {
    const text = (id: string) =>
      page.container.querySelector(`[data-testid="board-card-${id}"]`)?.textContent ?? "";
    expect(text("t-urgent")).toContain("RAK-4 · Urgent");
    expect(text("t-high")).toContain("RAK-5 · High");
    expect(text("t-normal")).not.toMatch(/Normal|Low|High|Urgent|·/);
    expect(text("t-low")).not.toMatch(/Normal|Low|High|Urgent|·/);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("creates a ticket without a status picker", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [] });
  api.tickets.create.mockResolvedValue({});
  const page = await renderBoard();
  try {
    expect(page.container.textContent).toContain("No tickets yet");
    expect(page.container.textContent).toContain("Tickets track work for your bots.");
    expect(page.container.querySelector("h1")?.textContent).toBe("Task board");
    expect(page.container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "New ticket")!
        .click(),
    );
    expect(
      Array.from(page.container.querySelectorAll("label")).map((label) => label.textContent),
    ).not.toContain("Status");
    const input = page.container.querySelector("form input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Launch",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      page.container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(api.tickets.create).toHaveBeenCalledWith({
      title: "Launch",
      description: "",
      assigneeBotId: "bot-1",
      priority: "normal",
    });
  } finally {
    await page.cleanup();
  }
});

function liveStream() {
  let deliver: ((result: IteratorResult<{ ticketId?: string }>) => void) | undefined;
  let fail: ((cause: Error) => void) | undefined;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  return {
    ready,
    stream: {
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise<IteratorResult<{ ticketId?: string }>>((resolve, reject) => {
            resolveReady();
            deliver = resolve;
            fail = reject;
          }),
      }),
    },
    event: (ticketId: string) => deliver?.({ done: false, value: { ticketId } }),
    end: () => deliver?.({ done: true, value: undefined }),
    error: () => fail?.(new Error("Disconnected")),
  };
}

it("saves only edits and refreshes comments for the open ticket", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper"), bot("bot-2", "Other")]);
  api.tickets.list.mockResolvedValue({
    tickets: [ticket("Ship", "ticket-1", "todo", "RAK-1", "bot-1", "Details")],
  });
  api.tickets.comments.mockReset().mockResolvedValue([{ id: "comment-1", body: "Ready" }]);
  api.tickets.update.mockReset().mockResolvedValue({});
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    const calls = api.tickets.comments.mock.calls.length;
    await act(async () => live.event("ticket-2"));
    expect(api.tickets.comments).toHaveBeenCalledTimes(calls);
    api.tickets.comments.mockResolvedValue([{ id: "comment-2", body: "Bot progress" }]);
    api.tickets.list.mockResolvedValue({
      tickets: [ticket("Ship", "ticket-1", "doing", "RAK-1", "bot-2", "Details")],
    });
    await act(async () => live.event("ticket-1"));
    expect(page.container.querySelector('[data-testid="ticket-comments"]')?.textContent).toContain(
      "Bot progress",
    );
    const input = page.container.querySelector("form input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Ship today",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      page.container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(api.tickets.update).toHaveBeenCalledWith({ id: "ticket-1", title: "Ship today" });
  } finally {
    await page.cleanup();
  }
});

it("closes the subscription before retrying a failed ticket refresh", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list
    .mockReset()
    .mockResolvedValueOnce({ tickets: [] })
    .mockRejectedValueOnce(new Error("Refresh failed"))
    .mockResolvedValue({ tickets: [ticket("After retry", "ticket-1")] });
  const next = vi.fn(() => new Promise<IteratorResult<{ ticketId?: string }>>(() => {}));
  const page = await renderBoard({ [Symbol.asyncIterator]: () => ({ next }) });
  try {
    const firstSignal = api.boards.subscribe.mock.calls[0]![1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(next).not.toHaveBeenCalled();
    expect(api.boards.subscribe).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
    const retrySignal = api.boards.subscribe.mock.calls[1]![1].signal as AbortSignal;
    expect(retrySignal).not.toBe(firstSignal);
    expect(retrySignal.aborted).toBe(false);
    expect(page.container.textContent).toContain("After retry");

    await page.cleanup();
    expect(retrySignal.aborted).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
  } finally {
    if (page.container.isConnected) await page.cleanup();
    vi.useRealTimers();
  }
});

const failingStream = {
  [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error("Down")) }),
};

it("backs off exponentially while the subscription keeps failing", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockReset().mockResolvedValue({ tickets: [] });
  const page = await renderBoard(failingStream);
  try {
    api.boards.subscribe.mockReset().mockRejectedValue(new Error("Down"));
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(3_999));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(3);
  } finally {
    if (page.container.isConnected) await page.cleanup();
    vi.useRealTimers();
  }
});

it("caps the reconnect delay at 30 seconds", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockReset().mockResolvedValue({ tickets: [] });
  const page = await renderBoard(failingStream);
  try {
    api.boards.subscribe.mockReset().mockRejectedValue(new Error("Down"));
    // Delays: 1s, 2s, 4s, 8s, 16s, then 30s.
    await act(async () => vi.advanceTimersByTimeAsync(31_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(5);
    await act(async () => vi.advanceTimersByTimeAsync(29_999));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(5);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(6);
  } finally {
    if (page.container.isConnected) await page.cleanup();
    vi.useRealTimers();
  }
});

it("resets the backoff once a frame arrives, not when subscribe succeeds", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockReset().mockResolvedValue({ tickets: [] });
  const page = await renderBoard(failingStream);
  try {
    const oneFrame = {
      [Symbol.asyncIterator]: () => {
        let sent = false;
        return {
          next: async (): Promise<IteratorResult<{ ticketId?: string }>> => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: {} };
          },
        };
      },
    };
    api.boards.subscribe
      .mockReset()
      .mockRejectedValueOnce(new Error("Down"))
      .mockResolvedValue(oneFrame);
    // Failure 2 (rejected subscribe) waits 2s, then a stream delivers a frame.
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1_999));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
    // The frame reset the backoff, so the retry after that stream ends takes 1s.
    await act(async () => vi.advanceTimersByTimeAsync(999));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.boards.subscribe).toHaveBeenCalledTimes(3);
  } finally {
    if (page.container.isConnected) await page.cleanup();
    vi.useRealTimers();
  }
});

it.each(["end", "error"] as const)(
  "reconnects after subscription %s and stops on unmount",
  async (failure) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
    api.tickets.list.mockReset().mockResolvedValue({ tickets: [] });
    const live = liveStream();
    const page = await renderBoard(live.stream);
    try {
      const reconnected = liveStream();
      api.boards.subscribe.mockResolvedValue(reconnected.stream);
      await act(async () => live[failure]());
      const calls = api.tickets.list.mock.calls.length;
      api.tickets.list.mockResolvedValue({ tickets: [ticket("After reconnect", "ticket-1")] });
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
      expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
      expect(api.tickets.list).toHaveBeenCalledTimes(calls + 1);
      expect(page.container.textContent).toContain("After reconnect");
      await act(async () => reconnected.end());
      await page.cleanup();
      await act(async () => vi.advanceTimersByTimeAsync(5_000));
      expect(api.boards.subscribe).toHaveBeenCalledTimes(2);
      expect(api.boards.subscribe.mock.calls[1]![1].signal.aborted).toBe(true);
    } finally {
      if (page.container.isConnected) await page.cleanup();
      vi.useRealTimers();
    }
  },
);

it("closes after create succeeds even when the following ticket reload fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockReset().mockResolvedValue({ tickets: [] });
  api.tickets.create.mockResolvedValue({});
  const page = await renderBoard();
  try {
    api.tickets.list.mockReset().mockRejectedValueOnce(new Error("Reload failed"));
    await act(async () => {
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "New ticket")!
        .click();
    });
    const input = page.container.querySelector("form input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Launch",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    api.tickets.create.mockClear();
    await act(async () =>
      page.container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(api.tickets.create).toHaveBeenCalledTimes(1);
    expect(page.container.querySelector("form input")).toBeNull();
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Reload failed");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("renders a new comment once when a stream refetch races the comment response", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  const newComment = {
    id: "comment-new",
    body: "Working on it",
    authorName: "Helper",
    createdAt: "2026-10-10T10:00:00Z",
  };
  let resolveComment!: (value: typeof newComment) => void;
  api.tickets.comments.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([newComment]);
  api.tickets.comment.mockReturnValue(
    new Promise((resolve) => {
      resolveComment = resolve;
    }),
  );
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    const textarea = page.container.querySelector('textarea[aria-label="Comment"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        textarea,
        newComment.body,
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      page.container
        .querySelectorAll('form button[type="submit"]')[1]!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await act(async () => live.event("ticket-1"));
    await act(async () => resolveComment(newComment));
    expect(page.container.querySelectorAll('[data-testid="chat-markdown"]')).toHaveLength(1);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps New ticket available when the first ticket load fails but bots load", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list
    .mockReset()
    .mockRejectedValueOnce(new Error("Tickets unavailable"))
    .mockResolvedValue({ tickets: [] });
  const page = await renderBoard();
  try {
    const button = Array.from(page.container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "New ticket",
    );
    expect(button?.disabled).toBe(false);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps a bot-loading error after the board stream connects", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockReset().mockRejectedValue(new Error("Bots unavailable"));
  api.tickets.list.mockResolvedValue({ tickets: [] });
  const page = await renderBoard(liveStream().stream);
  try {
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Bots unavailable",
    );
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("moves a ticket from its card menu and reloads it into the new column", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  let boardTickets = [ticket("Ship", "ticket-1")];
  api.tickets.list.mockImplementation(async () => ({ tickets: boardTickets }));
  api.tickets.move.mockImplementation(async ({ status }) => {
    boardTickets = [ticket("Ship", "ticket-1", status)];
    return {};
  });
  const page = await renderBoard();
  try {
    const trigger = page.container.querySelector('[aria-label="Move to"]');
    expect(trigger).not.toBeNull();
    await act(async () => (trigger as HTMLButtonElement).click());
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    expect(api.tickets.move).toHaveBeenCalledWith({ id: "ticket-1", status: "done" });
    const doneColumn = Array.from(page.container.querySelectorAll("section")).find(
      (section) => section.querySelector("h2")?.textContent === "Done",
    );
    expect(doneColumn?.querySelector('[data-testid="board-card-ticket-1"]')).not.toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps a ticket in its column and reports a failed card menu move", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  api.tickets.move.mockRejectedValue(new Error("Move failed"));
  const page = await renderBoard();
  try {
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    expect(api.tickets.move).toHaveBeenCalledWith({ id: "ticket-1", status: "done" });
    expect(document.activeElement).toBe(page.container.querySelector('[aria-label="Move to"]'));
    const todoColumn = Array.from(page.container.querySelectorAll("section")).find(
      (section) => section.querySelector("h2")?.textContent === "To do",
    );
    expect(todoColumn?.querySelector('[data-testid="board-card-ticket-1"]')).not.toBeNull();
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Move failed");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("clears a failed move alert when the board stream reloads", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  api.tickets.move.mockRejectedValue(new Error("Move failed"));
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    const reconnected = liveStream();
    api.boards.subscribe.mockResolvedValue(reconnected.stream);
    await act(async () => live.end());
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
    await page.cleanup();
  } finally {
    if (page.container.isConnected) await page.cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("clears a failed post-move reload after the stream reloads the moved ticket", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  let movedTicket = ticket("Ship", "ticket-1");
  api.tickets.list.mockImplementation(async () => ({ tickets: [movedTicket] }));
  api.tickets.move.mockImplementation(async ({ status }) => {
    movedTicket = ticket("Ship", "ticket-1", status);
    return {};
  });
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    api.tickets.list
      .mockReset()
      .mockRejectedValueOnce(new Error("Reload failed"))
      .mockImplementation(async () => ({ tickets: [movedTicket] }));
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Reload failed");

    const reconnected = liveStream();
    api.boards.subscribe.mockResolvedValue(reconnected.stream);
    await act(async () => live.end());
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
    const doneColumn = Array.from(page.container.querySelectorAll("section")).find(
      (section) => section.querySelector("h2")?.textContent === "Done",
    );
    expect(doneColumn?.querySelector('[data-testid="board-card-ticket-1"]')).not.toBeNull();
  } finally {
    await page.cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("shows Unassigned as the owner of an unassigned ticket in its dialog", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("No owner", "ticket-1")] });
  api.tickets.comments.mockResolvedValue([]);
  const page = await renderBoard();
  try {
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    const owner = page.container.querySelector('select[id$="-owner"]') as HTMLSelectElement;
    expect(owner.value).toBe("");
    expect(Array.from(owner.options).map((option) => option.textContent)).toContain("Unassigned");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("clears filters from the No matches state", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  const page = await renderBoard(undefined, false, "/app/board?q=missing&owner=bot-1");
  try {
    expect(page.container.textContent).toContain("No matches");
    const clear = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear all",
    );
    expect(clear).toBeDefined();
    await act(async () => clear!.click());
    expect(page.container.querySelector('[data-testid="location-search"]')?.textContent).toBe("");
    expect(page.container.querySelector('[data-testid="board-card-ticket-1"]')).not.toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("does not prompt for New ticket in the empty state when there are no bots", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([]);
  api.tickets.list.mockResolvedValue({ tickets: [] });
  const page = await renderBoard();
  try {
    expect(page.container.textContent).toContain("No tickets yet");
    expect(page.container.textContent).not.toContain("or press New ticket");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("does not offer Unassigned for an assigned ticket or a new ticket", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({
    tickets: [ticket("Owned", "ticket-1", "todo", "RAK-1", "bot-1")],
  });
  api.tickets.comments.mockResolvedValue([]);
  const page = await renderBoard();
  try {
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    const assignedOwner = page.container.querySelector('select[id$="-owner"]') as HTMLSelectElement;
    expect(Array.from(assignedOwner.options).map((option) => option.textContent)).not.toContain(
      "Unassigned",
    );
    await act(async () =>
      page.container
        .querySelector('[role="dialog"]')
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "New ticket")!
        .click(),
    );
    const newOwner = page.container.querySelector('select[id$="-owner"]') as HTMLSelectElement;
    expect(Array.from(newOwner.options).map((option) => option.textContent)).not.toContain(
      "Unassigned",
    );
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("clears a page alert after a successful ticket save and reload", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({
    tickets: [ticket("Launch", "ticket-1", "todo", "RAK-1", "bot-1")],
  });
  api.tickets.create.mockResolvedValue({});
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () => live.ready);
    await act(async () => live.error());
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Disconnected");
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "New ticket")!
        .click(),
    );
    const input = page.container.querySelector("form input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Launch",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      page.container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("clears a move error after a successful ticket save", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  api.tickets.move.mockRejectedValue(new Error("Move failed"));
  api.tickets.comments.mockResolvedValue([]);
  api.tickets.update.mockResolvedValue({});
  const page = await renderBoard();
  try {
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Move failed");
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    await act(async () =>
      page.container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("clears a move error after a successful ticket stream reload", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  api.tickets.move.mockRejectedValue(new Error("Move failed"));
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Move failed");
    await act(async () => live.event("ticket-1"));
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("does not clear a ticket stream error after a successful move", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  api.tickets.move.mockResolvedValue({});
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () => live.ready);
    await act(async () => live.error());
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Disconnected");
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    expect(page.container.querySelector('[role="alert"]')?.textContent).toContain("Disconnected");
  } finally {
    await page.cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("retains a locally appended comment when an older comments response arrives later", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  const newComment = {
    id: "comment-new",
    body: "Working on it",
    authorName: "Helper",
    createdAt: "2026-10-10T10:00:00Z",
  };
  let resolveOlder!: (value: { id: string; body: string }[]) => void;
  api.tickets.comments.mockReset().mockReturnValue(
    new Promise((resolve) => {
      resolveOlder = resolve;
    }),
  );
  api.tickets.comment.mockResolvedValue(newComment);
  const page = await renderBoard();
  try {
    await act(async () =>
      (
        page.container.querySelector('[data-testid="board-card-ticket-1"]') as HTMLButtonElement
      ).click(),
    );
    const textarea = page.container.querySelector('textarea[aria-label="Comment"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        textarea,
        newComment.body,
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      page.container
        .querySelectorAll('form button[type="submit"]')[1]!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(page.container.querySelector('[data-testid="ticket-comments"]')?.textContent).toContain(
      newComment.body,
    );
    await act(async () => resolveOlder([{ id: "comment-old", body: "Older list" }]));
    const comments = page.container.querySelector('[data-testid="ticket-comments"]')!;
    expect(comments.textContent).toContain(newComment.body);
    expect(comments.textContent).not.toContain("Older list");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("moves keyboard focus to the card after a keyboard move", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  let boardTickets = [ticket("Ship", "ticket-1")];
  api.tickets.list.mockImplementation(async () => ({ tickets: boardTickets }));
  api.tickets.move.mockImplementation(async ({ status }) => {
    boardTickets = [ticket("Ship", "ticket-1", status)];
    return {};
  });
  const page = await renderBoard();
  try {
    const trigger = page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement;
    trigger.focus();
    await act(async () =>
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    const done = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Done",
    )!;
    done.focus();
    await act(async () => {
      done.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      done.click();
    });
    expect(document.activeElement).toBe(
      page.container.querySelector('[data-testid="board-card-ticket-1"]'),
    );
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("closes the move menu on Escape and returns focus to its trigger", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  const page = await renderBoard();
  try {
    const trigger = page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement;
    await act(async () => trigger.click());
    expect(
      Array.from(page.container.querySelectorAll("button")).some(
        (button) => button.textContent === "Done",
      ),
    ).toBe(true);
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(
      Array.from(page.container.querySelectorAll("button")).some(
        (button) => button.textContent === "Done",
      ),
    ).toBe(false);
    expect(document.activeElement).toBe(trigger);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("blocks a second move while the move trigger is disabled", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.tickets.move.mockClear();
  api.bots.list.mockResolvedValue([bot("bot-1", "Helper")]);
  api.tickets.list.mockResolvedValue({ tickets: [ticket("Ship", "ticket-1")] });
  api.tickets.move.mockReturnValue(new Promise(() => {}));
  const page = await renderBoard();
  try {
    await act(async () =>
      (page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement).click(),
    );
    await act(async () =>
      Array.from(page.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Done")!
        .click(),
    );
    const trigger = page.container.querySelector('[aria-label="Move to"]') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    await act(async () => trigger.click());
    expect(api.tickets.move).toHaveBeenCalledTimes(1);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps the newest bot response when an older refresh resolves later", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const resolvers: ((value: ReturnType<typeof bot>[]) => void)[] = [];
  api.bots.list
    .mockReset()
    .mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
  api.tickets.list.mockResolvedValue({
    tickets: [ticket("Ship", "ticket-1", "todo", "RAK-1", "new-bot")],
  });
  const live = liveStream();
  const page = await renderBoard(live.stream);
  try {
    await act(async () => live.ready);
    expect(resolvers).toHaveLength(2);
    await act(async () => resolvers[1]!([bot("new-bot", "New bot")]));
    await act(async () => resolvers[0]!([bot("old-bot", "Old bot")]));
    const card = page.container.querySelector('[data-testid="board-card-ticket-1"]');
    expect(card?.textContent).toContain("New bot");
    expect(card?.textContent).not.toContain("Old bot");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});
