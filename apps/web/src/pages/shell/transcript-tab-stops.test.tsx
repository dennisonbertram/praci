// @vitest-environment jsdom

import type { ThreadMessage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
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

it("exposes one Tab stop for the messages' More buttons, and Up and Down move between them", async () => {
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
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <Transcript
        scrollRef={createRef<HTMLDivElement>()}
        sentHere={{ current: false }}
        scrollRequest={null}
        onScrollRequestHandled={noop}
        artifactTarget={{ botId: "bot_demo" }}
        messages={messages}
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
      />,
    ),
  );
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
