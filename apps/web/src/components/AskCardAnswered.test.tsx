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

import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";

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

it("shows Denied in the destructive colour", () => {
  const denied = render("deny");
  expect(denied.textContent).toBe("Denied");
  expect(denied.className).toContain("text-destructive");
  expect(denied.className).not.toContain("text-success");
});

it.each([
  ["allow", "text-foreground", "lucide-check"],
  ["always", "text-foreground", "lucide-check"],
  ["deny", "text-destructive", "lucide-x"],
  ["confirm-payment", "text-muted-foreground", null],
])("shows the %s outcome without success green", (answer, colour, icon) => {
  const line = render(answer);
  expect(line.className).toContain(colour);
  expect(line.className).not.toContain("text-success");
  if (icon) expect(line.querySelector(`svg.${icon}`)).toBeTruthy();
  else expect(line.querySelector("svg")).toBeNull();
});

it.each([
  ["allow", "Approved"],
  ["always", "Always allowed"],
  ["deny", "Denied"],
])("words the %s answer as %s", (answer, words) => {
  expect(render(answer).textContent).toBe(words);
});

it("shows a typed answer once: the card says Answered, the user bubble carries the text", () => {
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(
      <AskCard
        block={{ kind: "ask", text: "Which month?", status: "answered", answer: "October" }}
        canAnswer={false}
        onAnswer={async () => undefined}
      />,
    ),
  );
  expect(container.querySelector(".font-medium")?.textContent).toBe("Answered");
  expect(container.textContent).not.toContain("October");
});
