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
import type { BotToolControls } from "./BotToolControls";
import { BotToolControlsContext } from "./BotToolControls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pending: AskBlock = {
  kind: "ask",
  text: "Allow it?",
  approvalEffectId: "effect_demo",
  actions: [
    { id: "allow", label: "Allow once" },
    { id: "always", label: "Always allow this tool" },
    { id: "deny", label: "Deny" },
  ],
  status: "pending",
};
const answered = (answer: string, extra: Partial<AskBlock> = {}): AskBlock => ({
  ...pending,
  ...extra,
  status: "answered",
  answer,
});

function mount(
  block: AskBlock,
  canAnswer: boolean,
  controls?: Partial<BotToolControls>,
  onAnswer: () => Promise<void> = async () => {
    throw new Error("down");
  },
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const draw = (b: AskBlock, can: boolean) =>
    act(() =>
      root.render(
        <BotToolControlsContext.Provider value={controls ? (controls as BotToolControls) : null}>
          <AskCard block={b} canAnswer={can} onAnswer={onAnswer} />
        </BotToolControlsContext.Provider>,
      ),
    );
  draw(block, canAnswer);
  return { container, draw };
}

const button = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name);
const findByRole = async (container: HTMLElement, role: string) =>
  container.querySelector<HTMLElement>(`[role="${role}"]`);

it("announces a submit error and hides it after the answer is settled", async () => {
  const { container, draw } = mount(pending, true);
  await act(async () => button(container, "Allow once")?.click());
  expect((await findByRole(container, "alert"))?.textContent).toContain("down");

  draw(answered("allow"), true);
  expect(await findByRole(container, "alert")).toBeNull();
});

it("hides the submit error once the card is answered or no longer answerable", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.UTC(2031, 0, 1)));
  const { container, draw } = mount(pending, true);
  await act(async () => button(container, "Allow once")?.click());
  expect(container.textContent).toContain("down");
  draw(answered("allow"), true);
  expect(container.textContent).not.toContain("down");
  draw(pending, true);
  expect(container.textContent).toContain("down");
  draw(pending, false);
  expect(container.textContent).not.toContain("down");
  vi.useRealTimers();
});

it("underlines the standing choice", () => {
  const { container } = mount(pending, true);
  expect(button(container, "Always allow this")?.className.split(" ")).toContain("underline");
});

it.each(["always", "always_routine", "always_bot_sites"])(
  "offers Change on a card answered %s",
  (answer) => {
    const openApprovalSettings = vi.fn();
    const { container } = mount(answered(answer), false, { openApprovalSettings });
    act(() => button(container, "Change")?.click());
    expect(openApprovalSettings).toHaveBeenCalledTimes(1);
  },
);

it.each([
  ["allow", {}],
  ["deny", {}],
  ["superseded", {}],
  ["skipped", {}],
  ["allow", { consent: { recipient: "x" } as never }],
  ["allow", { share: { to: "x" } as never }],
  [
    "always",
    {
      actions: [
        { id: "allow", label: "Allow for this run" },
        { id: "always", label: "Always for this agent" },
      ],
    },
  ],
])("has no Change on %s %j", (answer, extra) => {
  const { container } = mount(answered(answer, extra as Partial<AskBlock>), false, {
    openApprovalSettings: vi.fn(),
  });
  expect(button(container, "Change")).toBeUndefined();
});

it("has no Change when the context cannot open settings", () => {
  const { container } = mount(answered("always"), false, {});
  expect(button(container, "Change")).toBeUndefined();
});
