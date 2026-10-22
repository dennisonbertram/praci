// @vitest-environment jsdom

import type { Bot, ThreadMessage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../../pages/shell/transcript", () => ({
  Transcript: ({ messages }: { messages: unknown[] }) => (
    <div data-testid="transcript">{messages.length}</div>
  ),
}));
vi.mock("../../pages/shell/composer", () => ({
  Composer: ({
    onSend,
    sendError,
    onRetrySend,
  }: {
    onSend: (text: string, mentions: unknown[], nonce: string) => void;
    sendError: string | null;
    onRetrySend: () => void;
  }) => (
    <>
      <button type="button" data-testid="composer" onClick={() => onSend("follow up", [], "n")} />
      {sendError ? (
        <>
          <p>{sendError}</p>
          <button type="button" onClick={onRetrySend}>
            Retry
          </button>
        </>
      ) : null}
    </>
  ),
}));
const get = vi.fn();
const navigate = vi.fn();
const send = vi.fn();
const markSeen = vi.fn(async () => ({ count: 0 }));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    notifications: { markSeen: (input: unknown) => markSeen(input) },
    threads: {
      get: (input: unknown) => get(input),
      send: (input: unknown) => send(input),
      stop: vi.fn(),
      answer: vi.fn(),
    },
  },
}));

import { EmailAgentPanel, latestPendingDraft } from "./EmailAgentPanel";

const bot = { id: "bot-1", name: "Thread agent", color: "#6366f1", status: "idle" } as Bot;
const card = (body: string, extra: Record<string, unknown> = {}) =>
  ({
    kind: "ask",
    text: "Send this reply?",
    status: "pending",
    mail: { tool: "mail_send", to: [], cc: [], bcc: [], subject: "Re: x", body, reply: true },
    ...extra,
  }) as ThreadMessage["blocks"][number];
const message = (seq: number, blocks: ThreadMessage["blocks"]): ThreadMessage =>
  ({ id: `m${seq}`, threadId: "t", seq, role: "bot", blocks, createdAt: "2026-10-01" }) as never;
const snapshot = (messages: ThreadMessage[], run: unknown = null) => ({
  threadId: "t",
  cursor: messages.length,
  messages,
  olderCursor: null,
  run,
});

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset();
  send.mockReset();
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const button = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );

it("takes the draft from the newest mail card still waiting for the owner", () => {
  expect(latestPendingDraft([message(1, [card("old")]), message(2, [card("new")])])).toBe("new");
  expect(latestPendingDraft([message(1, [card("done", { status: "answered" })])])).toBeUndefined();
  expect(latestPendingDraft([message(1, [{ kind: "text", text: "hi" }])])).toBeUndefined();
});

it("ignores a mail_draft card: only a mail_send reply is a draft", () => {
  const saved = card("saved in Gmail");
  (saved as { mail: { tool: string } }).mail.tool = "mail_draft";
  expect(latestPendingDraft([message(1, [saved])])).toBeUndefined();
});

it("offers Reply with draft only when the agent proposed one, and hands over its text", async () => {
  get.mockResolvedValue(snapshot([message(1, [card("Hi Sam")])]));
  const onReplyWithDraft = vi.fn();
  act(() =>
    root.render(
      <EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={onReplyWithDraft} />,
    ),
  );
  await flush();
  act(() => button("Reply with draft")?.click());
  expect(onReplyWithDraft).toHaveBeenCalledWith("Hi Sam");

  get.mockResolvedValue(snapshot([message(1, [{ kind: "text", text: "No draft yet" }])]));
  act(() =>
    root.render(
      <EmailAgentPanel
        bot={{ ...bot, id: "bot-2" }}
        onClose={() => {}}
        onReplyWithDraft={() => {}}
      />,
    ),
  );
  await flush();
  expect(button("Reply with draft")).toBeUndefined();
});

it("closes from its header and opens the full chat from the name", async () => {
  get.mockResolvedValue(snapshot([]));
  const onClose = vi.fn();
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={onClose} onReplyWithDraft={() => {}} />),
  );
  await flush();
  act(() => button("Close agent")?.click());
  expect(onClose).toHaveBeenCalledTimes(1);
  act(() => button("Open email agent full screen")?.click());
  expect(navigate).toHaveBeenCalledWith("/app/bot-1");
});

it("polls only while a run is active, and stops when the panel closes", async () => {
  get.mockResolvedValue(snapshot([message(1, [])], { id: "r1", status: "running" }));
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  expect(get).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000);
  });
  expect(get.mock.calls.length).toBeGreaterThan(1);
  const callsBeforeClose = get.mock.calls.length;
  act(() => root.render(<div />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(get).toHaveBeenCalledTimes(callsBeforeClose);
});

it("does not poll when no run is active", async () => {
  get.mockResolvedValue(snapshot([message(1, [])]));
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(get).toHaveBeenCalledTimes(1);
});

it("offers a Draft a reply chip in the empty panel that sends the request", async () => {
  get.mockResolvedValue(snapshot([]));
  send.mockResolvedValue({});
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  await act(async () => button("Draft a reply")?.click());
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ botId: "bot-1", text: "Draft a reply" }),
  );
});

const context = {
  ...message(0, [{ kind: "mail_thread", subject: "x", messages: [] }]),
  role: "system",
} as ThreadMessage;
const peer = (seq: number, role: "user" | "bot", kind: string) =>
  ({ ...message(seq, [{ kind, text: "ping" } as never]), role }) as ThreadMessage;

it("shows the chip when only the context card and agent entries are in the thread", async () => {
  get.mockResolvedValue(snapshot([context, peer(1, "user", "bot_message_received")]));
  send.mockResolvedValue({});
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  expect(button("Draft a reply")).toBeDefined();
});

it("hides Reply with draft after a send until a fresh snapshot, and disables the chip while sending", async () => {
  get.mockResolvedValue(snapshot([message(1, [card("Hi Sam")])]));
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  expect(button("Reply with draft")).toBeDefined();
  send.mockResolvedValue({});
  get.mockRejectedValue(new Error("offline"));
  await act(async () =>
    (document.querySelector('[data-testid="composer"]') as HTMLElement).click(),
  );
  await flush();
  expect(button("Reply with draft")).toBeUndefined();
  send.mockReset();
  let finish: (v: unknown) => void = () => {};
  send.mockReturnValue(new Promise((r) => (finish = r)));
  get.mockResolvedValue(snapshot([]));
  act(() =>
    root.render(
      <EmailAgentPanel bot={{ ...bot, id: "b3" }} onClose={() => {}} onReplyWithDraft={() => {}} />,
    ),
  );
  await flush();
  act(() => button("Draft a reply")?.click());
  act(() => button("Draft a reply")?.click());
  expect(send).toHaveBeenCalledTimes(1);
  expect((button("Draft a reply") as HTMLButtonElement).disabled).toBe(true);
  finish({});
  await flush();
});

it("shows a plain message and Retry when the agent cannot be reached", async () => {
  get.mockResolvedValue(snapshot([]));
  send.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({});
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  act(() => button("Draft a reply")?.click());
  await flush();
  expect(document.body.textContent).toContain("Could not reach Praci. Try again.");
  expect(document.body.textContent).not.toContain("Failed to fetch");
  act(() => button("Retry")?.click());
  await flush();
  expect(send).toHaveBeenCalledTimes(2);
});

it("has a labelled Back control that closes the panel", async () => {
  get.mockResolvedValue(snapshot([]));
  const onClose = vi.fn();
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={onClose} onReplyWithDraft={() => {}} />),
  );
  await flush();
  act(() => (document.querySelector('[aria-label="Back to email"]') as HTMLElement).click());
  expect(onClose).toHaveBeenCalled();
});

it("marks the email agent's notifications seen once its card is on screen", async () => {
  get.mockResolvedValue(snapshot([message(1, [card("Hi Sam")])]));
  act(() =>
    root.render(<EmailAgentPanel bot={bot} onClose={() => {}} onReplyWithDraft={() => {}} />),
  );
  await flush();
  expect(markSeen).toHaveBeenCalledWith({ botId: "bot-1" });
});
