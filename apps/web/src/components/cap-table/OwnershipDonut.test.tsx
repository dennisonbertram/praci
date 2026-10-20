// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { groupClasses, OwnershipDonut } from "./OwnershipDonut";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const classes = [
  { name: "Common", shares: 600 },
  { name: "Series A Preferred", shares: 300 },
  { name: "Options", shares: 100 },
];

async function mount(ui: React.ReactElement) {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => root.render(ui));
  return el;
}

it("sums to exactly 100 after rounding", () => {
  const out = groupClasses([1, 1, 1].map((shares, i) => ({ name: `C${i}`, shares })));
  expect(out.reduce((n, s) => n + s.percent, 0)).toBeCloseTo(100, 5);
  expect(out.map((s) => s.percent).sort()).toEqual([33.33, 33.33, 33.34]);
});

it("keeps five classes and merges the rest into Other", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, shares: 100 - i }));
  const out = groupClasses(many);
  expect(out).toHaveLength(6);
  expect(out[5]?.name).toBe("Other");
  expect(out[5]?.shares).toBe(95 + 94 + 93);
});

it("describes the top classes and lists every value in a hidden table", async () => {
  setHideAmounts(true); // not money: still shown
  const el = await mount(<OwnershipDonut classes={classes} fullyDilutedShares={1000} />);
  expect(el.querySelector("[role=img]")?.getAttribute("aria-label")).toBe(
    "Ownership: Common 60.00%, Series A Preferred 30.00%, Options 10.00%",
  );
  expect(el.querySelectorAll("table.sr-only tbody tr")).toHaveLength(3);
  expect(el.textContent).toContain("1,000");
  setHideAmounts(false);
});

it("shows a tooltip on hover and on focus", async () => {
  const el = await mount(<OwnershipDonut classes={classes} fullyDilutedShares={1000} />);
  expect(el.querySelector("[role=tooltip]")).toBeNull();
  await act(async () => {
    el.querySelectorAll("[data-testid=donut-slice]")[1]?.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true }),
    );
  });
  expect(el.querySelector("[role=tooltip]")?.textContent).toContain("Series A Preferred");
  expect(el.querySelector("[role=tooltip]")?.textContent).toContain("30.00%");
  await act(async () => {
    el.querySelectorAll("li > div")[2]?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
  expect(el.querySelector("[role=tooltip]")?.textContent).toContain("Options");
});

it("selects a class only when it maps to a security", async () => {
  const onSelect = vi.fn();
  const el = await mount(
    <OwnershipDonut
      classes={classes}
      fullyDilutedShares={1000}
      selectable={["Common"]}
      onSelect={onSelect}
    />,
  );
  await act(async () => {
    for (const i of [0, 1])
      el.querySelectorAll("[data-testid=donut-slice]")[i]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
  });
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith("Common");
});

it("renders nothing without classes", async () => {
  const el = await mount(<OwnershipDonut classes={[]} fullyDilutedShares={null} />);
  expect(el.innerHTML).toBe("");
});
