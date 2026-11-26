// @vitest-environment jsdom

import type { ThreadMessage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import type { SendTarget } from "../../components/data-room/SendToAgent";
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

import { Transcript } from "./transcript";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
const noop = () => undefined;
const asyncNoop = async () => {};

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

async function mount(
  list: ThreadMessage[],
  onSendFiles?: (m: ThreadMessage, a: SendTarget) => void,
) {
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
          sendTargets={[{ id: "bot_other", name: "Legal agent", color: "#336699" }]}
          onSendFiles={onSendFiles}
        />
      </MemoryRouter>,
    ),
  );
  return el;
}

const bot = (id: string, blocks: ThreadMessage["blocks"]): ThreadMessage => ({
  id,
  threadId: "thread_demo",
  seq: 1,
  role: "bot",
  botId: "bot_demo",
  blocks,
  createdAt: "2026-01-01T10:00:00.000Z",
});
const withFile = bot("m_file", [
  {
    kind: "file",
    artifactId: "artifact_1",
    name: "transcript.md",
    mimeType: "text/markdown",
    size: 7300,
  },
]);
const textOnly = bot("m_text", [{ kind: "text", text: "Done" }]);

const openMore = async (el: HTMLElement) => {
  const button = el.querySelector<HTMLElement>("[data-message-more]");
  await act(async () => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};

it("offers Send to agent only on a message that carries a file", async () => {
  setup();
  const noFile = await mount([textOnly], vi.fn());
  await openMore(noFile);
  expect(document.body.textContent).not.toContain("Send to agent");
  document.body.replaceChildren();
  const el = await mount([withFile], vi.fn());
  await openMore(el);
  expect(document.body.textContent).toContain("Send to agent");
});

it("hands the message and the chosen agent to onSendFiles", async () => {
  setup();
  const onSendFiles = vi.fn();
  document.body.replaceChildren();
  const el = await mount([withFile], onSendFiles);
  await openMore(el);
  const trigger = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((n) =>
    n.textContent?.includes("Send to agent"),
  );
  await act(async () => trigger?.click());
  const agent = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((n) =>
    n.textContent?.includes("Legal agent"),
  );
  await act(async () => agent?.click());
  expect(onSendFiles).toHaveBeenCalledWith(withFile, expect.objectContaining({ id: "bot_other" }));
});
