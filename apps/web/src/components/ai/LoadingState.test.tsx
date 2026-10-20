// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { LoadingState } from "./primitives";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  setHideAmounts(false);
});

function mount(detail: string) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (next: string) =>
    act(() =>
      root.render(
        <LoadingState
          label="Searching your mail"
          detail={next}
          waitingLabel="Still waiting on Gmail"
          startedAt={Date.now()}
        />,
      ),
    );
  show(detail);
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const text = () => container.querySelector('[data-testid="working-detail"]')?.textContent ?? "";
  return { show, advance, text, container };
}

it("shows the latest step with no clock while steps keep arriving", () => {
  const view = mount("Searching mail: from Kevin");
  view.advance(10_000);
  expect(view.text()).toBe("Searching mail: from Kevin");
});

it("adds the time since the last step after 15 seconds", () => {
  const view = mount("Searching mail: from Kevin");
  view.advance(18_000);
  expect(view.text()).toBe("Searching mail: from Kevin · 18s");
  expect(view.container.querySelector('[data-testid="working-waiting"]')).toBeNull();
});

it("says it is still waiting after 45 seconds", () => {
  const view = mount("Searching mail: from Kevin");
  view.advance(46_000);
  expect(view.text()).toBe("Searching mail: from Kevin · 46s · Still waiting on Gmail");
});

it("starts the quiet time again when a new step arrives", () => {
  const view = mount("Searching mail: from Kevin");
  view.advance(50_000);
  view.show("Found 23 messages");
  expect(view.text()).toBe("Found 23 messages");
  view.advance(16_000);
  expect(view.text()).toBe("Found 23 messages · 16s");
});

it("masks amounts in the step while amounts are hidden", () => {
  setHideAmounts(true);
  const view = mount('Reading "Invoice for $12,400" from billing@example.test');
  expect(view.text()).not.toContain("12,400");
  expect(view.text()).toContain("billing@example.test");
});
