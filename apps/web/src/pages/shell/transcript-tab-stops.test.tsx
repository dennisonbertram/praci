// @vitest-environment jsdom

import type { ThreadMessage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

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

import { Transcript } from "./transcript";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
const noop = () => undefined;
const asyncNoop = async () => {};
const messages: ThreadMessage[] = Array.from({ length: 14 }, (_, i) => ({
  id: `message_${i}`,
  threadId: "thread_demo",
  seq: i + 1,
  role: i % 2 ? "bot" : "user",
  blocks: [{ kind: "text", text: `Message ${i}` }],
  ...(i % 2 ? { botId: "bot_demo" } : {}),
  createdAt: `2026-01-01T10:${String(i).padStart(2, "0")}:00.000Z`,
}));

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

async function mount(list: ThreadMessage[]) {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <MemoryRouter>
        <Transcript
          scrollRef={createRef<HTMLDivElement>()}
          sentHere={{ current: false }}
          scrollRequest={null}
          onScrollRequestHandled={noop}
          artifactTarget={{ botId: "bot_demo" }}
          messages={list}
          showToolActivity={false}
          olderCursor={null}
          loadingOlder={false}
          answerableAskMessageId={null}
          running={false}
          workingBots={[]}
          onLoadOlder={asyncNoop}
          onOpenBot={noop}
          onAnswer={asyncNoop}
          onReply={noop}
          onQuote={noop}
          onReact={asyncNoop}
          onJumpToMessage={noop}
          onOpenPeerMessages={noop}
          peerBot={() => undefined}
          onRefresh={asyncNoop}
          onBotChanged={asyncNoop}
          onAddRoutine={noop}
          voiceReady={false}
          speakingMessageId={null}
          onSpeak={noop}
          onOpenComputer={noop}
        />
      </MemoryRouter>,
    ),
  );
  return el;
}

it("exposes one Tab stop for the messages' More buttons, and Up and Down move between them", async () => {
  setup();
  const el = await mount(messages);
  const more = [...el.querySelectorAll<HTMLElement>("[data-message-more]")];
  expect(more).toHaveLength(14);
  expect(more.filter((b) => b.tabIndex >= 0)).toEqual([more[13]]);
  // The reader moves up one message: that button becomes the Tab stop.
  await act(async () => more[13]?.focus());
  await act(async () => {
    more[13]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
    );
  });
  expect(document.activeElement).toBe(more[12]);
  expect(more.filter((b) => b.tabIndex >= 0)).toEqual([more[12]]);
});

it("keeps a Tab stop when the newest messages are folded into a finance group", async () => {
  setup();
  const finance = [14, 15].map(
    (i): ThreadMessage => ({
      id: `message_${i}`,
      threadId: "thread_demo",
      seq: i + 1,
      role: "bot",
      botId: "bot_demo",
      blocks: [
        {
          kind: "finance",
          card: {
            card: "overview",
            cashCents: 1,
            burnCents: 1,
            runwayMonths: 1,
            monthSpendCents: 1,
          },
        },
      ],
      createdAt: `2026-01-01T10:${String(i).padStart(2, "0")}:00.000Z`,
    }),
  );
  const el = await mount([...messages, ...finance]);
  const more = [...el.querySelectorAll<HTMLElement>("[data-message-more]")];
  expect(more.filter((b) => b.tabIndex >= 0)).toHaveLength(1);
});
