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
  ["superseded", "text-muted-foreground", null],
  ["expired", "text-muted-foreground", null],
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
  ["superseded", "No longer active"],
  ["expired", "Expired"],
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

it("says an approved payment still waits for its provider, and when it was requested", () => {
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(
      <AskCard
        block={{ ...answered("allow"), waitsFor: "Mercury" }}
        canAnswer={false}
        requestedAt="2026-10-22T07:44:00.000Z"
        onAnswer={async () => undefined}
      />,
    ),
  );
  const line = container.querySelector(".font-medium") as HTMLElement;
  expect(line.textContent).toContain("Approved here. Waiting for Mercury");
  expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(
    "2026-10-22T07:44:00.000Z",
  );
});

it("closes Details on an answered card, denied or approved", () => {
  for (const answer of ["allow", "deny"]) {
    const container = document.createElement("div");
    const block = { ...answered(answer), detail: "amount: 5", detailFolded: true };
    act(() =>
      createRoot(container).render(
        <AskCard block={block} canAnswer={false} onAnswer={async () => undefined} />,
      ),
    );
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
  }
});

it("shows a long instruction in full, with no nested scroll box", () => {
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(
      <AskCard
        block={{
          ...answered("allow"),
          status: "pending",
          answer: undefined,
          detail: "x ".repeat(400),
        }}
        canAnswer
        onAnswer={async () => undefined}
      />,
    ),
  );
  expect(container.querySelector(".overflow-auto")).toBeNull();
});
