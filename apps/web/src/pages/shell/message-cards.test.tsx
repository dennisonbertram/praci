// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { ChartCanvas } from "./message-cards";

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
