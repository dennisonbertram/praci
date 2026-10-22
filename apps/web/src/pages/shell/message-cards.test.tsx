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
import { ChartCanvas, ChoiceCard } from "./message-cards";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setHideAmounts(false));

it("does not draw a chart while amounts are hidden, so no raw value reaches the plot", async () => {
  setHideAmounts(true);
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
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
});

it("says what each first-run focus covers until one is picked", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const block = {
    kind: "choice" as const,
    question: "What do you want me on first?",
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
        block={{ ...block, answerId: "company" }}
        onBotChanged={async () => {}}
      />,
    ),
  );
  expect(el.textContent).not.toContain("Email, calendar and your company pages");
});
