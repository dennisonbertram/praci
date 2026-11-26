// @vitest-environment jsdom

import type { ThreadMessage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createElement, createRef } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { delegateWaitTarget } from "../../lib/delegate-wait";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray | string, ...values: unknown[]) =>
      typeof parts === "string"
        ? parts
        : parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
    i18n: { locale: "en" },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
  Plural: ({ other }: { other: string }) => other,
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/ui-web", async (orig) => ({
  ...(await orig<object>()),
  enqueueNotificationToast: toast,
}));

const markdownRender = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children: string }) => {
    markdownRender(children);
    return createElement("span", null, children);
  },
}));

import { Transcript } from "./transcript";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
const noop = () => undefined;
const asyncNoop = async () => {};
const artifactTarget = { botId: "bot_demo" };

function setup() {
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener: noop,
    removeEventListener: noop,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver ??= class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  } as unknown as typeof ResizeObserver;
}

function setClipboard(value: Clipboard | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.replaceChildren();
  toast.mockClear();
  setClipboard(undefined);
});

function renderTranscript(
  root: Root,
  list: ThreadMessage[],
  callbacks: {
    onReply?: (message: ThreadMessage) => void;
    onSpeak?: (message: ThreadMessage) => void;
  } = {},
) {
  return root.render(
    <MemoryRouter>
      <Transcript
        scrollRef={createRef<HTMLDivElement>()}
        sentHere={{ current: false }}
        scrollRequest={null}
        onScrollRequestHandled={noop}
        artifactTarget={artifactTarget}
        messages={list}
        delegate={delegateWaitTarget(list)}
        showToolActivity={false}
        olderCursor={null}
        loadingOlder={false}
        answerableAskMessageId={null}
        running={false}
        workingBots={[]}
        onLoadOlder={asyncNoop}
        onOpenBot={noop}
        onAnswer={asyncNoop}
        onReply={callbacks.onReply ?? noop}
        onQuote={(...args) => {
          void args;
        }}
        onReact={asyncNoop}
        onJumpToMessage={noop}
        onOpenPeerMessages={noop}
        peerBot={() => undefined}
        onRefresh={asyncNoop}
        onBotChanged={asyncNoop}
        onAddRoutine={noop}
        voiceReady={false}
        speakingMessageId={null}
        onSpeak={callbacks.onSpeak ?? noop}
        onOpenComputer={noop}
        sendTargets={[]}
        onSendFiles={noop}
      />
    </MemoryRouter>,
  );
}

async function mount(list: ThreadMessage[]) {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  roots.push(root);
  await act(async () => renderTranscript(root, list));
  return el;
}

const message: ThreadMessage = {
  id: "m_text",
  threadId: "thread_demo",
  seq: 1,
  role: "bot",
  botId: "bot_demo",
  blocks: [{ kind: "text", text: "Done" }],
  createdAt: "2026-01-01T10:00:00.000Z",
};

const copy = async (el: HTMLElement) => {
  const more = el.querySelector<HTMLElement>("[data-message-more]");
  await act(async () => more?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (n) => n.textContent === "Copy",
  );
  await act(async () => item?.click());
};

it("does not re-render unchanged message markdown when callbacks and messages change", async () => {
  setup();
  markdownRender.mockClear();
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  roots.push(root);
  await act(async () => renderTranscript(root, [message], { onReply: () => undefined }));

  const nextMessage: ThreadMessage = {
    ...message,
    id: "m_next",
    seq: 2,
    blocks: [{ kind: "text", text: "Another message" }],
  };
  await act(async () =>
    renderTranscript(root, [message, nextMessage], {
      onReply: () => undefined,
      onSpeak: () => undefined,
    }),
  );

  expect(markdownRender.mock.calls.filter(([text]) => text === "Done")).toHaveLength(1);
});

it("says Copied after copying a message", async () => {
  setup();
  const writeText = vi.fn(() => Promise.resolve());
  setClipboard({ writeText } as unknown as Clipboard);
  const el = await mount([message]);
  await copy(el);
  expect(writeText).toHaveBeenCalledWith("Done");
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copied", timeout: 2000 }));
});

it("turns off live announcements for progress while keeping text blocks unchanged", async () => {
  setup();
  const progressMessage: ThreadMessage = {
    ...message,
    id: "progress:m_live",
    blocks: [{ kind: "progress", text: "Still working" }],
  };
  const mixedProgressMessage: ThreadMessage = {
    ...message,
    id: "m_mixed_progress",
    seq: 2,
    blocks: [
      { kind: "progress", text: "Checking" },
      {
        kind: "file",
        artifactId: "artifact_demo",
        name: "notes.txt",
        mimeType: "text/plain",
        size: 10,
      },
    ],
  };
  const textMessage: ThreadMessage = {
    ...message,
    id: "m_final",
    seq: 3,
    blocks: [{ kind: "text", text: "Done" }],
  };

  const el = await mount([progressMessage, mixedProgressMessage, textMessage]);
  const progressWrapper = [
    ...el.querySelectorAll<HTMLElement>("[data-testid=message-bot-bubble] > div"),
  ].find((wrapper) => wrapper.textContent?.includes("Still working"));
  const textWrapper = [
    ...el.querySelectorAll<HTMLElement>("[data-testid=message-bot-bubble] > div"),
  ].find((wrapper) => wrapper.textContent?.includes("Done"));
  const mixedProgressBubble = [
    ...el.querySelectorAll<HTMLElement>("[data-testid=message-bot-bubble]"),
  ].find((bubble) => bubble.textContent?.includes("Checking"));

  expect(progressWrapper?.getAttribute("aria-live")).toBe("off");
  expect(mixedProgressBubble?.getAttribute("aria-live")).toBe("off");
  expect(textWrapper?.hasAttribute("aria-live")).toBe(false);
});

it("says Couldn't copy when the clipboard refuses", async () => {
  setup();
  setClipboard({
    writeText: vi.fn(() => Promise.reject(new Error("denied"))),
  } as unknown as Clipboard);
  const el = await mount([message]);
  await copy(el);
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't copy" }));
});

it("says Couldn't copy when the clipboard is unavailable", async () => {
  setup();
  setClipboard(undefined);
  const el = await mount([message]);
  await copy(el);
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't copy" }));
});
