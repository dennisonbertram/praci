// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoalCard } from "../components/goal-card";
import { GoalLine } from "../components/goal-line";

vi.mock("react-native", () => {
  const Surface = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  const Pressable = ({
    children,
    onPress,
    accessibilityLabel,
    accessibilityState,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityState?: { expanded?: boolean };
  }) =>
    createElement(
      "button",
      {
        type: "button",
        "aria-label": accessibilityLabel,
        "aria-expanded": accessibilityState?.expanded,
        onClick: onPress,
      },
      children,
    );
  return { View: Surface, Text: Surface, Pressable };
});
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) =>
    createElement("button", { type: "button", "aria-label": accessibilityLabel, onClick: onPress }),
}));
vi.mock("../components/native-symbol", () => ({
  NativeSymbol: () => createElement("span", null, "chevron"),
}));
vi.mock("../lib/native", () => ({
  native: new Proxy({}, { get: () => "n" }),
}));
const hide = vi.hoisted(() => ({ on: false }));
vi.mock("./hide-amounts", async () => {
  const { maskCurrencyText } = await import("@rakazo/chat-ui/mask-currency");
  return {
    useHideAmounts: () => hide.on,
    maskAmountsWhenHidden: (text: string) => (hide.on ? maskCurrencyText(text) : text),
  };
});
vi.mock("./appearance", () => ({
  mobileTokens: () => ({ foreground: "f", mutedForeground: "m", border: "b", card: "c" }),
}));
vi.mock("./i18n", () => ({
  t: (text: string, values?: Record<string, string | number>) =>
    values
      ? text.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) =>
          key in values ? String(values[key]) : match,
        )
      : text,
}));

describe("goal components", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("shows the goal text, no status while working, and clears on tap", () => {
    const onClear = vi.fn();
    act(() =>
      root.render(<GoalLine goal={{ text: "Find suppliers", status: null }} onClear={onClear} />),
    );
    expect(container.textContent).toBe("Find suppliers");
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Clear goal"]')!.click(),
    );
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("adds the status word when the goal is not working", () => {
    act(() =>
      root.render(
        <GoalLine goal={{ text: "Find suppliers", status: "Waiting on you" }} onClear={vi.fn()} />,
      ),
    );
    expect(container.textContent).toBe("Find suppliersWaiting on you");
  });

  it.each([
    ["met", "Goal met"],
    ["blocked", "Goal blocked"],
    ["stopped", "Goal stopped"],
  ] as const)("renders a %s outcome with its reason", (outcome, title) => {
    act(() =>
      root.render(
        <GoalCard
          block={{
            kind: "goal",
            outcome,
            reason: "After 25 runs.",
            text: `${title}. After 25 runs.`,
          }}
        />,
      ),
    );
    expect(container.textContent).toBe(`${title}After 25 runs.`);
  });

  const metWithEvidence = {
    kind: "goal" as const,
    outcome: "met" as const,
    reason: "Three suppliers found.",
    text: "Goal met. Three suppliers found.",
    evidence: [
      { id: "r1.t1", text: "web_search: Mug Co" },
      { id: "r2.t1", text: "mail_search: 3 matching threads" },
    ],
  };

  it("keeps a met goal's evidence closed until the trigger is pressed", () => {
    act(() => root.render(<GoalCard block={metWithEvidence} />));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
    expect(trigger?.textContent).toContain("Evidence · 2");
    expect(container.textContent).not.toContain("Mug Co");
    act(() => trigger!.click());
    expect(container.textContent).toContain("Web search: Mug Co");
    expect(container.textContent).toContain("Mail search: 3 matching threads");
  });

  it("masks amounts in an evidence row while amounts are hidden", () => {
    hide.on = true;
    try {
      act(() =>
        root.render(
          <GoalCard
            block={{
              ...metWithEvidence,
              evidence: [{ id: "r1.t1", text: 'web_search: {"price":"$4.20"}' }],
            }}
          />,
        ),
      );
      act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
      expect(container.textContent).not.toContain("4.20");
      expect(container.textContent).toContain("$•••");
    } finally {
      hide.on = false;
    }
  });

  it("shows no evidence trigger without cited evidence or for a blocked goal", () => {
    act(() =>
      root.render(
        <GoalCard
          block={{ kind: "goal", outcome: "met", reason: "Done.", text: "Goal met. Done." }}
        />,
      ),
    );
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
    act(() => root.render(<GoalCard block={{ ...metWithEvidence, outcome: "blocked" }} />));
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
  });
});
