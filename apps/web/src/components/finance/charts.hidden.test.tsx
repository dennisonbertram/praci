// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { LineChart } from "./charts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setHideAmounts(false));

it("does not draw a finance chart while amounts are hidden, so its shape shows no trend", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  setHideAmounts(true);
  await act(async () =>
    root.render(
      <LineChart
        label="Projected cash"
        height={160}
        values={[300, 200, 100, 0]}
        labels={["Oct", "Nov", "Dec", "Jan"]}
      />,
    ),
  );
  expect(el.querySelector("svg")).toBeNull();
  expect(el.textContent).toContain("Chart hidden while amounts are hidden");
  await act(async () => setHideAmounts(false));
  expect(el.querySelector("[data-testid=chart-hidden]")).toBeNull();
  act(() => root.unmount());
});
