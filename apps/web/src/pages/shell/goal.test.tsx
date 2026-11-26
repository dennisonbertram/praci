// @vitest-environment jsdom

import type { ThreadGoal, ThreadSnapshot } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { resetHideAmountsMemory, setHideAmounts } from "../../lib/hide-amounts-preference";
import { GoalBlockView, GoalLine, GoalNotice, isGoalReply, snapshotWithGoal } from "./goal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const goal: ThreadGoal = {
  id: "goal-1",
  text: "Find three suppliers for ceramic mugs and list their prices",
  status: "active",
  stopReason: null,
  lastReason: null,
  continuations: 0,
  startedAt: "2026-01-01T00:00:00.000Z",
};
const render = (node: ReactNode) => act(async () => root.render(node));
const line = () => container.querySelector("[data-testid='goal-line']");

it("shows only the goal text while the bot is working", async () => {
  await render(<GoalLine goal={goal} waiting={false} onClear={() => {}} />);
  expect(line()?.getAttribute("aria-label")).toBe("Goal");
  expect(line()?.textContent).toContain("Find three suppliers");
  expect(line()?.textContent).not.toContain("Paused");
  expect(line()?.textContent).not.toContain("Waiting on you");
});

it("says Paused for a paused goal", async () => {
  await render(
    <GoalLine goal={{ ...goal, status: "paused" }} waiting={false} onClear={() => {}} />,
  );
  expect(line()?.textContent).toContain("Paused");
});

it("says Waiting on you while an active goal waits for a card or question", async () => {
  await render(<GoalLine goal={goal} waiting onClear={() => {}} />);
  expect(line()?.textContent).toContain("Waiting on you");
});

it("clears the goal from the labelled button", async () => {
  const onClear = vi.fn();
  await render(<GoalLine goal={goal} waiting={false} onClear={onClear} />);
  const button = container.querySelector<HTMLButtonElement>("button[aria-label='Clear goal']");
  await act(async () => button?.click());
  expect(onClear).toHaveBeenCalledOnce();
});

it("expands the full goal text on demand", async () => {
  await render(<GoalLine goal={goal} waiting={false} onClear={() => {}} />);
  const toggle = container.querySelector<HTMLButtonElement>("button[aria-expanded]");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  expect(toggle?.title).toBe(goal.text);
  await act(async () => toggle?.click());
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
});

it.each([
  ["met", "Goal met", "All three found."],
  ["blocked", "Goal blocked", "Needs your sign-in."],
  ["stopped", "Goal stopped", "After 25 runs."],
] as const)("renders a %s goal block with its reason", async (outcome, title, reason) => {
  await render(
    <GoalBlockView block={{ kind: "goal", outcome, reason, text: `${title}. ${reason}` }} />,
  );
  const block = container.querySelector("[data-testid='goal-block']");
  expect(block?.textContent).toContain(title);
  expect(block?.textContent).toContain(reason);
  expect(block?.getAttribute("data-outcome")).toBe(outcome);
});

it("recognises the server's goal reply and shows it as a status, not an alert", async () => {
  expect(isGoalReply({ data: { goalReply: true }, message: "No goal set." })).toBe(true);
  expect(isGoalReply(new Error("boom"))).toBe(false);
  const dismiss = vi.fn();
  await render(<GoalNotice message="Goal cleared." onDismiss={dismiss} />);
  expect(container.querySelector("[role='alert']")).toBeNull();
  expect(container.querySelector("[role='status']")?.textContent).toContain("Goal cleared.");
  await act(async () => container.querySelector<HTMLButtonElement>("button")?.click());
  expect(dismiss).toHaveBeenCalledOnce();
});

it("applies a thread.goal.updated payload to the snapshot", () => {
  const snapshot = { threadId: "t1", goal: null } as ThreadSnapshot;
  expect(snapshotWithGoal(snapshot, { goal })?.goal).toEqual(goal);
  expect(
    snapshotWithGoal({ ...snapshot, goal } as ThreadSnapshot, { goal: null })?.goal,
  ).toBeNull();
  expect(snapshotWithGoal(snapshot, { goal: { bad: true } })).toBe(snapshot);
  expect(snapshotWithGoal(null, { goal })).toBeNull();
});

const metWithEvidence = {
  kind: "goal" as const,
  outcome: "met" as const,
  reason: "Three suppliers found.",
  text: "Goal met. Three suppliers found.",
  evidence: [
    { id: "r1.t1", text: 'web_search: {"title":"Mug Co"}' },
    { id: "r2.t1", text: "mail_search: 3 matching threads" },
  ],
};

it("keeps the evidence disclosure centred in the goal block, not at the page edge", async () => {
  await render(<GoalBlockView block={metWithEvidence} />);
  const details = container.querySelector("details");
  const block = container.querySelector("[data-testid='goal-block']");
  // An over-wide disclosure would be centred by the block and overhang the message column on both sides.
  expect(details?.parentElement).toBe(block);
  expect(block?.className).toContain("items-center");
  expect(details?.className).toContain("w-fit");
  expect(details?.className).toContain("max-w-full");
  // The label sits centred under the reason; the rows' rail starts at the container's left edge.
  expect(details?.querySelector("summary")?.className).toContain("mx-auto");
});

it("shows only the tool name for a cited call that recorded no result", async () => {
  await render(
    <GoalBlockView
      block={{ ...metWithEvidence, evidence: [{ id: "r1.t1", text: "search_history:" }] }}
    />,
  );
  container.querySelector<HTMLDetailsElement>("details")?.querySelector("summary")?.click();
  const rows = container.querySelectorAll("[data-testid='tool-call']");
  expect(rows.length).toBe(1);
  expect(rows[0]?.getAttribute("title")).toBe("search_history");
  // No empty result line under the name.
  expect(rows[0]?.parentElement?.children.length).toBe(1);
});

it("shows a met goal's evidence behind a closed disclosure", async () => {
  await render(<GoalBlockView block={metWithEvidence} />);
  const summary = container.querySelector("details > summary");
  expect(summary?.textContent).toBe("Evidence · 2");
  expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
});

it("lists the cited tool calls and their results once the disclosure opens", async () => {
  await render(<GoalBlockView block={metWithEvidence} />);
  const details = container.querySelector<HTMLDetailsElement>("details");
  details?.querySelector("summary")?.click();
  expect(details?.open).toBe(true);
  const rows = container.querySelectorAll("[data-testid='tool-call']");
  expect(rows.length).toBe(2);
  expect(rows[0]?.getAttribute("title")).toBe("web_search");
  expect(rows[1]?.getAttribute("title")).toBe("mail_search");
  expect(container.textContent).toContain('{"title":"Mug Co"}');
  expect(container.textContent).toContain("3 matching threads");
});

it("masks amounts in an evidence row and its tooltip while amounts are hidden", async () => {
  setHideAmounts(true);
  try {
    await render(
      <GoalBlockView
        block={{
          ...metWithEvidence,
          evidence: [{ id: "r1.t1", text: 'web_search: {"price":"$4.20"}' }],
        }}
      />,
    );
    container.querySelector<HTMLDetailsElement>("details")?.querySelector("summary")?.click();
    const titles = [...container.querySelectorAll("[title]")].map(
      (node) => node.getAttribute("title") ?? "",
    );
    expect(container.textContent).not.toContain("4.20");
    expect(titles).toContain('{"price":"$•••"}');
    for (const title of titles) expect(title).not.toContain("4.20");
  } finally {
    resetHideAmountsMemory();
  }
});

it("shows no evidence disclosure without cited evidence or for a blocked goal", async () => {
  await render(
    <GoalBlockView
      block={{ kind: "goal", outcome: "met", reason: "Done.", text: "Goal met. Done." }}
    />,
  );
  expect(container.querySelector("details")).toBeNull();
  await render(
    <GoalBlockView
      block={{ ...metWithEvidence, outcome: "blocked", text: "Goal blocked. Needs you." }}
    />,
  );
  expect(container.querySelector("details")).toBeNull();
});
