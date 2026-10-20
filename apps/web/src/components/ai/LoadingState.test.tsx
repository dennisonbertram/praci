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

function mount(detail: string, detailSince?: number, waiting = "Still waiting on Gmail") {
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (next: string) =>
    act(() =>
      root.render(
        <LoadingState
          label="Searching your mail"
          detail={next}
          waitingLabel={waiting}
          detailSince={detailSince}
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

it("counts the quiet time of a run phase from when the phase began", () => {
  const view = mount("Starting the computer", Date.now(), "Still waiting on the computer");
  expect(view.text()).toBe("Starting the computer");
  view.advance(16_000);
  expect(view.text()).toBe("Starting the computer · 16s");
  view.advance(30_000);
  expect(view.text()).toBe("Starting the computer · 46s · Still waiting on the computer");
});

it("counts from detailSince in the past, as after a reload", () => {
  const view = mount("Starting the computer", Date.now() - 50_000, "Still waiting on the computer");
  view.advance(1_000);
  expect(view.text()).toBe("Starting the computer · 51s · Still waiting on the computer");
});
