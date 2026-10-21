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

const pending: AskBlock = {
  kind: "ask",
  text: "Send $1,200.00 to Acme Supplies from Operating?",
  approvalEffectId: "effect_demo",
  actions: [
    { id: "allow", label: "Allow once" },
    { id: "always", label: "Always allow this tool" },
    { id: "deny", label: "Deny" },
  ],
  status: "pending",
};

function mount(onAnswer: (text: string) => Promise<void>) {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(<AskCard block={pending} canAnswer onAnswer={onAnswer} />),
  );
  return container;
}

const button = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLElement;

it("is a group named by its question", () => {
  const group = mount(async () => undefined).querySelector("[role=group]") as HTMLElement;
  const label = document.getElementById(group.getAttribute("aria-labelledby") ?? "");
  expect(label?.textContent).toBe(pending.text);
});

it("keeps Always allow quiet, with its consequence beside it", () => {
  const container = mount(async () => undefined);
  const always = button(container, "Always allow this");
  expect(always.className).toContain("underline");
  expect(button(container, "Allow once").className).not.toContain("underline");
  expect(container.textContent).toContain("Won't ask again for this kind of action.");
  expect(container.textContent).not.toContain("tool");
});

it("moves focus to the composer once the answer is sent", async () => {
  const composer = document.createElement("textarea");
  composer.setAttribute("data-composer-input", "");
  document.body.append(composer);
  const container = mount(async () => undefined);
  await act(async () => button(container, "Allow once").click());
  expect(document.activeElement).toBe(composer);
});
