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
vi.mock("@rakazo/chat-ui/web", () => ({ ChatMarkdown: () => null }));

import { type AskBlock, AskCard } from "./AskCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const consent = (overrides: Partial<AskBlock> = {}): AskBlock => ({
  kind: "ask",
  text: "Allow your mail to be sent to Example?",
  detail: "Messages are sent to run your bots.",
  approvalEffectId: "effect_demo",
  consent: { version: "2026-09-14" },
  actions: [
    { id: "allow", label: "Allow" },
    { id: "deny", label: "Not now" },
  ],
  status: "pending",
  ...overrides,
});

function render(block: AskBlock, onAnswer = vi.fn(async () => undefined)) {
  const container = document.createElement("div");
  act(() => createRoot(container).render(<AskCard block={block} canAnswer onAnswer={onAnswer} />));
  return { container, onAnswer };
}

it("offers Allow and Not now, and sends the chosen action id", async () => {
  const { container, onAnswer } = render(consent());
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.map((button) => button.textContent)).toEqual(["Allow", "Not now"]);
  expect(container.textContent).toContain("Messages are sent to run your bots.");
  await act(async () => buttons[0]!.click());
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined);
});

it.each([
  ["allow", "Allowed"],
  ["deny", "Not now"],
])("shows %s as %s once answered", (answer, label) => {
  const { container } = render(consent({ status: "answered", answer }));
  expect(container.querySelector(".font-medium")?.textContent).toBe(label);
});
