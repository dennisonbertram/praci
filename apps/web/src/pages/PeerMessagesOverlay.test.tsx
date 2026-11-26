// @vitest-environment jsdom

import type { ThreadMessage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const { messagesRpc } = vi.hoisted(() => ({ messagesRpc: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { threads: { messages: messagesRpc } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  BotAvatar: () => null,
  Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogClose: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <div {...props}>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

import { formatRelativeTime } from "../lib/relative-time";
import { PeerMessagesOverlay } from "./PeerMessagesOverlay";

function message(id: string, text: string, seq: number): ThreadMessage {
  return {
    id,
    threadId: "thread-a",
    seq,
    role: "bot",
    createdAt: "2026-01-01T00:00:00.000Z",
    blocks: [{ kind: "bot_message_sent", toBotId: "peer", toBotName: "Peer", text }],
  } as ThreadMessage;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  messagesRpc.mockReset();
});

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  };
  await act(async () =>
    root.render(
      <PeerMessagesOverlay
        botId="bot"
        botName="Bot"
        botColor="ink"
        peerBotId="peer"
        peerBotName="Peer"
        peerBotColor="muted"
        onClose={() => undefined}
      />,
    ),
  );
  return container;
}

it("renders the first page while older pages are still loading", async () => {
  const older = deferred<{ messages: ThreadMessage[]; olderCursor: number | null }>();
  messagesRpc
    .mockResolvedValueOnce({ messages: [message("new", "New page", 2)], olderCursor: 2 })
    .mockReturnValueOnce(older.promise);
  const container = await mount();
  await act(async () => Promise.resolve());
  expect(container.textContent).toContain("New page");
  expect(container.textContent).not.toContain("Loading…");
});

it("keeps loading when the peer has no messages on the newest page", async () => {
  const older = deferred<{ messages: ThreadMessage[]; olderCursor: number | null }>();
  messagesRpc
    .mockResolvedValueOnce({ messages: [], olderCursor: 5 })
    .mockReturnValueOnce(older.promise);
  const container = await mount();
  await act(async () => Promise.resolve());
  expect(container.textContent).not.toContain("No messages with");
  expect(container.textContent).toContain("Loading…");
});

it("shows the chat retry when an older page fails without a peer conversation", async () => {
  messagesRpc
    .mockResolvedValueOnce({ messages: [], olderCursor: 5 })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ messages: [], olderCursor: null });
  const container = await mount();
  await act(async () => Promise.resolve());
  expect(container.textContent).toContain("Could not load this chat.");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Retry now",
  )!;
  await act(async () => retry.click());
  await act(async () => Promise.resolve());
  expect(messagesRpc.mock.calls.map(([args]) => args.before)).toEqual([undefined, 5, 5]);
});

it("adds older pages in order without duplicating overlapping messages", async () => {
  const older = deferred<{ messages: ThreadMessage[]; olderCursor: number | null }>();
  messagesRpc
    .mockResolvedValueOnce({ messages: [message("new", "New page", 2)], olderCursor: 2 })
    .mockReturnValueOnce(older.promise);
  const container = await mount();
  await act(async () => Promise.resolve());
  await act(async () =>
    older.resolve({
      messages: [message("old", "Old page", 1), message("new", "New page", 2)],
      olderCursor: null,
    }),
  );
  const transcript = container.querySelector('[data-testid="peer-conversation-transcript"]')!;
  expect(transcript.textContent).toContain("Old page");
  expect(transcript.textContent).toContain("New page");
  expect(transcript.textContent!.indexOf("Old page")).toBeLessThan(
    transcript.textContent!.indexOf("New page"),
  );
  expect(transcript.textContent!.match(/New page/g)).toHaveLength(1);
});

it("keeps shown messages after an older-page failure and retries from its cursor", async () => {
  messagesRpc
    .mockResolvedValueOnce({ messages: [message("new", "Shown message", 2)], olderCursor: 2 })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      messages: [message("old", "Recovered older message", 1)],
      olderCursor: null,
    });
  const container = await mount();
  await act(async () => Promise.resolve());
  expect(container.textContent).toContain("Shown message");
  expect(container.textContent).toContain("Could not load older messages");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Retry now",
  )!;
  await act(async () => retry.click());
  await act(async () => Promise.resolve());
  expect(messagesRpc.mock.calls.map(([args]) => args.before)).toEqual([undefined, 2, 2]);
  expect(container.textContent).toContain("Recovered older message");
});

it("shows the existing relative time on each exchange", async () => {
  const item = message("sent", "Timed message", 1);
  messagesRpc.mockResolvedValueOnce({ messages: [item], olderCursor: null });
  const container = await mount();
  await act(async () => Promise.resolve());
  expect(container.textContent).toContain(formatRelativeTime(item.createdAt));
});
