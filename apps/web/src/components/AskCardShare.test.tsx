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

import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const held = (overrides: Partial<AskBlock> = {}): AskBlock => ({
  kind: "ask",
  text: "Share with Support?",
  detail: "The lead investor is priya@example.test.",
  approvalEffectId: "effect_demo",
  share: true,
  actions: [
    { id: "allow", label: "Share" },
    { id: "deny", label: "Don't share" },
  ],
  status: "pending",
  ...overrides,
});

function render(block: AskBlock, onAnswer = vi.fn(async () => undefined)) {
  const container = document.createElement("div");
  act(() => createRoot(container).render(<AskCard block={block} canAnswer onAnswer={onAnswer} />));
  return { container, onAnswer };
}

it("shows the exact text and offers Share and Don't share, with no Always allow", async () => {
  const { container, onAnswer } = render(held());
  expect(container.textContent).toContain("The lead investor is priya@example.test.");
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.map((button) => button.textContent)).toEqual(["Share", "Don't share"]);
  await act(async () => buttons[0]!.click());
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined);
});

it.each([
  ["allow", "Shared"],
  ["deny", "Not shared"],
])("shows %s as %s once answered", (answer, label) => {
  const { container } = render(held({ status: "answered", answer }));
  expect(container.querySelector(".font-medium")?.textContent).toBe(label);
});
