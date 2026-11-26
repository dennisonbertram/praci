// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../lib/rpc", () => ({ rpc: {} }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { ChartCanvas, ChoiceCard, ResultCard } from "./message-cards";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setHideAmounts(false));

it("does not draw a chart while amounts are hidden, so no raw value reaches the plot", async () => {
  setHideAmounts(true);
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () =>
    root.render(
      <ChartCanvas
        spec={{ marks: [{ type: "barY", options: { x: "m", y: "v" } }] }}
        data={[{ m: "Sep", v: 73781 }]}
        width={400}
      />,
    ),
  );
  expect(el.querySelector("[data-testid=chart-hidden]")).not.toBeNull();
  expect(el.innerHTML).not.toContain("73781");
  expect(el.querySelector("svg")).toBeNull();
  await act(async () => root.unmount());
});

it("says what each first-run focus covers until one is picked", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const block = {
    kind: "choice" as const,
    question: "What should I work on first?",
    options: [
      { id: "company", letter: "A", label: "Run my company" },
      { id: "research", letter: "D", label: "Research & writing" },
    ],
  };
  const root = createRoot(el);
  await act(async () =>
    root.render(<ChoiceCard botId="bot-1" block={block} onBotChanged={async () => {}} />),
  );
  expect(el.textContent).toContain("Email, calendar and your company pages");
  expect(el.textContent).toContain("The web, notes and docs");
  await act(async () =>
    root.render(
      <ChoiceCard
        botId="bot-1"
        block={{ ...block, question: "What do you want me on first?" }}
        onBotChanged={async () => {}}
      />,
    ),
  );
  expect(el.textContent).toContain("What should I work on first?");
  expect(el.textContent).toContain("The web, notes and docs");
  await act(async () =>
    root.render(
      <ChoiceCard
        botId="bot-1"
        block={{ ...block, answerId: "company" }}
        onBotChanged={async () => {}}
      />,
    ),
  );
  expect(el.textContent).not.toContain("Email, calendar and your company pages");
});

it("tells the two first-run focuses apart and keeps the chosen row at full contrast", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const block = {
    kind: "choice" as const,
    question: "What should I work on first?",
    options: [
      { id: "company", letter: "A", label: "Run my company" },
      { id: "day", letter: "B", label: "Day-to-day work" },
    ],
  };
  const root = createRoot(el);
  await act(async () =>
    root.render(<ChoiceCard botId="bot-1" block={block} onBotChanged={async () => {}} />),
  );
  expect(el.textContent).toContain("Slack and your calendar");
  expect(el.textContent).not.toContain("Slack, calendar and email");
  await act(async () =>
    root.render(
      <ChoiceCard
        botId="bot-1"
        block={{ ...block, answerId: "day" }}
        onBotChanged={async () => {}}
      />,
    ),
  );
  expect(el.querySelector("button")?.className).not.toContain("opacity-60");
});

it("masks every value in a result card while amounts are hidden and shows them again after", async () => {
  setHideAmounts(true);
  const el = document.createElement("div");
  document.body.append(el);
  const card = {
    kind: "card" as const,
    lines: [
      { k: "Cash", v: "$1,633,221" },
      { k: "Runway", v: "10 months" },
    ],
  };
  await act(async () => createRoot(el).render(<ResultCard block={card} />));
  expect(el.textContent).not.toContain("1,633,221");
  expect(el.textContent).toContain("10 months");
  await act(async () => setHideAmounts(false));
  expect(el.textContent).toContain("$1,633,221");
});

it("draws every choice option as a bordered card, answered or not", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const block = {
    kind: "choice" as const,
    question: "What do you want me for?",
    options: [
      { id: "setup-research", letter: "A", label: "Research something" },
      { id: "setup-email", letter: "C", label: "Help with email" },
    ],
  };
  const root = createRoot(el);
  const optionButtons = () =>
    [...el.querySelectorAll("button")].filter(
      (button) =>
        button.textContent?.includes("Research something") ||
        button.textContent?.includes("Help with email"),
    );
  await act(async () =>
    root.render(<ChoiceCard botId="bot-1" block={block} onBotChanged={async () => {}} />),
  );
  expect(optionButtons()).toHaveLength(2);
  for (const button of optionButtons()) expect(button.className).toContain("border-border");
  await act(async () =>
    root.render(
      <ChoiceCard
        botId="bot-1"
        block={{ ...block, answerId: "setup-research" }}
        onBotChanged={async () => {}}
      />,
    ),
  );
  expect(optionButtons()).toHaveLength(1);
  expect(optionButtons()[0]?.className).toContain("border-border");
  await act(async () => root.unmount());
});
