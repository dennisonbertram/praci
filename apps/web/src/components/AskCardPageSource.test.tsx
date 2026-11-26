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

const card = (overrides: Partial<AskBlock> = {}): AskBlock => ({
  kind: "ask",
  text: "Read Mercury every hour?",
  detail: "Request: getAccounts\nPage: Finance",
  pageSource: { sourceId: "src_1", callHash: "0".repeat(64) },
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

it("shows the request and offers Allow and Not now", async () => {
  const { container, onAnswer } = render(card());
  expect(container.textContent).toContain("Read Mercury every hour?");
  expect(container.textContent).toContain("Request: getAccounts");
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.map((button) => button.textContent)).toEqual(["Allow", "Not now"]);
  await act(async () => buttons[1]!.click());
  expect(onAnswer).toHaveBeenCalledWith("deny", undefined);
});

it.each([
  ["allow", "Allowed"],
  ["deny", "Not now"],
  ["superseded", "Replaced by a newer request"],
])("shows %s as %s once answered", (answer, label) => {
  const { container } = render(card({ status: "answered", answer }));
  expect(container.querySelector(".font-medium")?.textContent).toBe(label);
  expect(container.querySelectorAll("button")).toHaveLength(0);
});
