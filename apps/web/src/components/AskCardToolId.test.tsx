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

const block: AskBlock = {
  kind: "ask",
  text: "Review before Carta: Discover",
  toolId: "mcp__integration-5f783c95__discover",
  approvalEffectId: "effect_demo",
  actions: [
    { id: "allow", label: "Allow once" },
    { id: "deny", label: "Deny" },
  ],
  status: "pending",
};

function mount(next: AskBlock) {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(<AskCard block={next} canAnswer onAnswer={async () => {}} />),
  );
  return container;
}

it("hides the raw tool id until the chevron is opened", () => {
  const container = mount(block);
  const toggle = container.querySelector("button[aria-expanded]") as HTMLElement;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(container.textContent).not.toContain("mcp__integration");
  act(() => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(container.textContent).toContain("mcp__integration-5f783c95__discover");
  act(() => toggle.click());
  expect(container.textContent).not.toContain("mcp__integration");
});

it("renders an older block without a tool id as before", () => {
  const container = mount({ ...block, toolId: undefined, detail: "tool: shell" });
  expect(container.querySelector("button[aria-expanded]")).toBeNull();
  expect(container.textContent).toContain("tool: shell");
});

it("names the disclosure with the readable tool name, not a generic label", () => {
  const container = mount(block);
  const toggle = container.querySelector("button[aria-expanded]") as HTMLElement;
  expect(toggle.getAttribute("aria-label")).toBeNull();
  expect(toggle.textContent).toBe("discover");
});
