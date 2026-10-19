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

const answered = (answer: string): AskBlock => ({
  kind: "ask",
  text: "Allow it?",
  approvalEffectId: "effect_demo",
  actions: [
    { id: "allow", label: "Allow once" },
    { id: "deny", label: "Deny" },
  ],
  status: "answered",
  answer,
});

function render(answer: string) {
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(
      <AskCard block={answered(answer)} canAnswer={false} onAnswer={async () => undefined} />,
    ),
  );
  return container.querySelector(".font-medium") as HTMLElement;
}

it("shows Denied in the destructive colour, not the success green of Allowed once", () => {
  expect(render("allow").className).toContain("text-success");
  const denied = render("deny");
  expect(denied.textContent).toBe("Denied");
  expect(denied.className).toContain("text-destructive");
  expect(denied.className).not.toContain("text-success");
});
