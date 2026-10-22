// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: String.raw }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: String.raw }));
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../lib/hide-amounts-preference";
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

// Each test starts a minute after the last, so an answer in one does not hold the next card's buttons.
let minute = 0;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.UTC(2030, 0, 1, 0, ++minute)));
});

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

it("moves focus to the composer after a plain question is answered", async () => {
  document.body.replaceChildren();
  const composer = document.createElement("textarea");
  composer.setAttribute("data-composer-input", "");
  document.body.append(composer);
  const container = document.createElement("div");
  document.body.append(container);
  const question: AskBlock = {
    kind: "ask",
    text: "Which month?",
    actions: [{ id: "june", label: "June" }],
    status: "pending",
  };
  act(() =>
    createRoot(container).render(
      <AskCard block={question} canAnswer onAnswer={async () => undefined} />,
    ),
  );
  await act(async () => button(container, "June").click());
  expect(document.activeElement).toBe(composer);
});

it("puts focus back on the composer when the answered state arrives after it was lost", async () => {
  document.body.replaceChildren();
  const composer = document.createElement("textarea");
  composer.setAttribute("data-composer-input", "");
  document.body.append(composer);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (block: AskBlock) =>
    act(() => root.render(<AskCard block={block} canAnswer onAnswer={async () => undefined} />));
  render(pending);
  await act(async () => button(container, "Allow once").click());
  composer.blur();
  expect(document.activeElement).toBe(document.body);
  render({ ...pending, status: "answered", answer: "allow" });
  expect(document.activeElement).toBe(composer);
});

it("shows the approval detail in the body font", () => {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(
      <AskCard
        block={{ ...pending, detail: "From Operating checking." }}
        canAnswer
        onAnswer={async () => undefined}
      />,
    ),
  );
  const detail = [...container.querySelectorAll("p, pre")].find(
    (el) => el.textContent === "From Operating checking.",
  );
  expect(detail?.className).not.toContain("font-mono");
});

it("labels a payment's main button with its amount and drops blank lines from Details", () => {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(
      <AskCard
        block={{
          ...pending,
          detail: "\n\nAmount: $300.00",
          detailFolded: true,
          actions: [
            { id: "allow", label: "Send $300.00" },
            { id: "deny", label: "Deny" },
          ],
        }}
        canAnswer
        onAnswer={async () => undefined}
      />,
    ),
  );
  expect(button(container, "Send $300.00")).toBeDefined();
  expect(button(container, "Allow once")).toBeUndefined();
  expect(container.querySelector("pre")?.textContent).toBe("Amount: $300.00");
});

it("masks the amount on a payment button while Hide amounts is on", () => {
  setHideAmounts(true);
  const container = document.createElement("div");
  document.body.append(container);
  const payment: AskBlock = {
    ...pending,
    actions: [
      { id: "allow", label: "Send $300.00" },
      { id: "deny", label: "Deny" },
    ],
  };
  act(() =>
    createRoot(container).render(
      <AskCard block={payment} canAnswer onAnswer={async () => undefined} />,
    ),
  );
  expect(container.textContent).not.toContain("300");
  expect(container.textContent).toContain("Send ");
  setHideAmounts(false);
});

it("holds a new card's buttons for a second after another card was answered", async () => {
  const first = mount(async () => undefined);
  await act(async () => button(first, "Allow once").click());
  const second = mount(async () => undefined);
  expect((button(second, "Allow once") as HTMLButtonElement).disabled).toBe(true);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 1100)));
  expect((button(second, "Allow once") as HTMLButtonElement).disabled).toBe(false);
});
