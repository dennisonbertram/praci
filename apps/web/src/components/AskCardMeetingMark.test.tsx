// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: String.raw }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: String.raw }));
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => children,
}));

import { MEETING_MARK_REASON } from "@rakazo/contracts";
import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";
import type { BotToolControls } from "./BotToolControls";
import { BotToolControlsContext } from "./BotToolControls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const block: AskBlock = {
  kind: "ask",
  text: "Allow the bot to send this email?",
  approvalEffectId: "effect_demo",
  approvalReason: MEETING_MARK_REASON,
  actions: [
    { id: "allow", label: "Allow once" },
    { id: "deny", label: "Deny" },
  ],
  status: "pending",
};

function mount(next: AskBlock, clearConversation?: () => void) {
  const container = document.createElement("div");
  document.body.append(container);
  const controls = { clearConversation } as unknown as BotToolControls;
  act(() =>
    createRoot(container).render(
      <BotToolControlsContext.Provider value={controls}>
        <AskCard block={next} canAnswer onAnswer={async () => {}} />
      </BotToolControlsContext.Provider>,
    ),
  );
  return container;
}

const clearButton = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "Clear conversation");

it("shows the meeting reason and a Clear conversation button that opens the clear flow", () => {
  const clear = vi.fn();
  const container = mount(block, clear);
  expect(container.textContent).toContain(MEETING_MARK_REASON);
  act(() => clearButton(container)?.click());
  expect(clear).toHaveBeenCalledTimes(1);
});

it("has no Clear button on other reasons or an answered card", () => {
  const clear = vi.fn();
  expect(
    clearButton(
      mount({ ...block, approvalReason: "Asked because this ran in the background." }, clear),
    ),
  ).toBeUndefined();
  expect(
    clearButton(mount({ ...block, status: "answered", answer: "deny" }, clear)),
  ).toBeUndefined();
});
