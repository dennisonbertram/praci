// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { groupClasses, OwnershipDonut, sliceArcs } from "./OwnershipDonut";

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

it("links a legend row and its slice in both directions", async () => {
  const el = await mount(<OwnershipDonut classes={classes} fullyDilutedShares={1000} />);
  const centre = () => el.querySelector("[data-testid=donut-centre]")?.textContent ?? "";
  expect(centre()).toBe("1,000Shares");
  const slices = () => [...el.querySelectorAll("[data-testid=donut-slice]")];
  await act(async () => {
    slices()[1]?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  });
  expect(centre()).toBe("300Series A Preferred");
  expect(el.querySelectorAll("li > div")[1]?.className).toContain("bg-foreground/10");
  expect(slices()[0]?.getAttribute("class")).toContain("opacity-30");
  await act(async () => {
    el.querySelectorAll("li > div")[2]?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
  expect(centre()).toBe("100Options");
  expect(slices()[2]?.getAttribute("class")).not.toContain("opacity-30");
});

it("adds a slice for shares no class holds, so the legend matches the centre", async () => {
  const el = await mount(<OwnershipDonut classes={classes} fullyDilutedShares={1250} />);
  expect(el.querySelector("[data-testid=donut-centre]")?.textContent).toBe(
    "1,250Fully diluted shares",
  );
  const rows = [...el.querySelectorAll("table.sr-only tbody tr")].map((r) => r.textContent);
  expect(rows).toContain("Options and pool20.00%250");
  expect(el.querySelectorAll("[data-testid=donut-slice]")).toHaveLength(4);
});

it("falls back to the listed total when the classes exceed fully diluted", async () => {
  const el = await mount(<OwnershipDonut classes={classes} fullyDilutedShares={500} />);
  expect(el.querySelectorAll("[data-testid=donut-slice]")).toHaveLength(3);
  expect(el.querySelector("[data-testid=donut-centre]")?.textContent).toBe("1,000Shares");
});

it("draws a tiny slice at the minimum angle and a single class as a full ring", () => {
  const tiny = sliceArcs([9934, 66])[1];
  const m = /^M([\d.]+),([\d.]+)A90,90 0 \d 1 ([\d.]+),([\d.]+)/.exec(tiny ?? "");
  const angle = (x: number, y: number) => Math.atan2(x - 96, 96 - y);
  const span =
    (angle(Number(m?.[3]), Number(m?.[4])) - angle(Number(m?.[1]), Number(m?.[2]))) % (2 * Math.PI);
  // 66 / 10000 is 0.66%; it is drawn wider (about 7 degrees minus the gap), never narrower than 3.
  expect(Math.abs(span)).toBeGreaterThan((3 * Math.PI) / 180);
  expect(sliceArcs([5])).toHaveLength(1);
  expect(sliceArcs([5])[0]).toContain("A90,90 0 1 1");
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
