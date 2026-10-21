// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
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
  expect(el.querySelector("[role=group]")?.getAttribute("aria-label")).toBe(
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
  expect((slices()[0] as SVGElement).style.opacity).toBe("0.3");
  await act(async () => {
    el.querySelectorAll("li > div")[2]?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
  expect(centre()).toBe("100Options");
  expect((slices()[2] as SVGElement).style.opacity).toBe("1");
});

it("leaves a legend row with no breakdown out of the tab order", async () => {
  const el = await mount(<OwnershipDonut classes={classes} fullyDilutedShares={1000} />);
  expect(el.querySelectorAll("li > div")[2]?.hasAttribute("tabindex")).toBe(false);
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

it("says how much of the option pool is still free", async () => {
  const el = await mount(
    <OwnershipDonut classes={classes} fullyDilutedShares={1250} optionPoolAvailable={250} />,
  );
  const rows = [...el.querySelectorAll("table.sr-only tbody tr")].map((r) => r.textContent);
  expect(rows).toContain("Option pool (250 available)20.00%250");
});

it("names the class above its holders when it is opened", async () => {
  const el = await mount(
    <OwnershipDonut
      classes={classes}
      fullyDilutedShares={1000}
      holdings={[{ name: "Ada", security: "Common", shares: 600 }]}
    />,
  );
  await act(async () => {
    el.querySelector<HTMLElement>("button[aria-label='Show Common breakdown']")?.click();
  });
  expect(el.querySelector("[data-testid=breakdown-head]")?.textContent).toBe("Commonof class");
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

const holdings = [
  { name: "Ada", security: "Common", shares: 300 },
  { name: "Ben", security: "Common", shares: 200 },
  { name: "Cy", security: "Common", shares: 100 },
  { name: "Di", security: "Series A Preferred", shares: 300 },
  { name: "Eve", security: "Options", shares: 60 },
];
const drillProps = { classes, fullyDilutedShares: 1000, holdings, optionPoolAvailable: 40 };
const isOpen = (el: HTMLElement) =>
  el.querySelector("[data-testid=breakdown]")?.getAttribute("data-open");
const click = (node: Element | null | undefined) =>
  act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const rowFor = (el: HTMLElement, name: string) =>
  el.querySelector(`button[aria-label='Show ${name} breakdown']`);
const legendRows = (el: HTMLElement) =>
  [
    ...el.querySelectorAll("[data-testid=breakdown-legend] li:not([data-testid=breakdown-head])"),
  ].map((li) => li.textContent);

it("opens a class breakdown by holder from a legend row, with totals that add up", async () => {
  const el = await mount(<OwnershipDonut {...drillProps} />);
  expect(el.querySelector("[data-testid=breakdown]")).toBeNull();
  await click(rowFor(el, "Common"));
  expect(isOpen(el)).toBe("true");
  expect(legendRows(el)).toEqual(["Ada50.00%300", "Ben33.33%200", "Cy16.67%100"]);
  expect(el.querySelector("[data-testid=breakdown-centre]")?.textContent).toBe("600Common");
  expect(el.querySelector("[data-testid=donut-projection]")).not.toBeNull();
});

it("opens a class whose name differs from the holders' security only by case or a note", async () => {
  const el = await mount(
    <OwnershipDonut
      {...drillProps}
      classes={[{ name: "Common (Mock)", shares: 600 }, ...classes.slice(1)]}
    />,
  );
  await click(rowFor(el, "Common (Mock)"));
  expect(isOpen(el)).toBe("true");
  expect(legendRows(el)).toEqual(["Ada50.00%300", "Ben33.33%200", "Cy16.67%100"]);
});

it("opens from a slice with Enter and Space, and names it", async () => {
  const el = await mount(<OwnershipDonut {...drillProps} />);
  const slice = el.querySelector("path[aria-label='Show Common breakdown']");
  expect(slice?.getAttribute("tabindex")).toBe("0");
  await act(async () => {
    slice?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(isOpen(el)).toBe("true");
  await click(el.querySelector("[aria-label=Back]"));
  await act(async () => {
    el.querySelector("path[aria-label='Show Common breakdown']")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
  });
  expect(isOpen(el)).toBe("true");
});

it("goes back with the button, Escape and the faded donut", async () => {
  const el = await mount(<OwnershipDonut {...drillProps} />);
  await click(rowFor(el, "Common"));
  await click(el.querySelector("[aria-label=Back]"));
  expect(isOpen(el)).toBe("false");
  await click(rowFor(el, "Common"));
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(isOpen(el)).toBe("false");
  await click(rowFor(el, "Common"));
  await click(el.querySelector("[data-testid=donut-original]"));
  expect(isOpen(el)).toBe("false");
});

it("switches class from the faded donut", async () => {
  const el = await mount(<OwnershipDonut {...drillProps} />);
  await click(rowFor(el, "Common"));
  await click(el.querySelectorAll("[data-testid=donut-slice]")[1]);
  expect(isOpen(el)).toBe("true");
  expect(el.querySelector("[data-testid=breakdown-centre]")?.textContent).toBe(
    "300Series A Preferred",
  );
});

it("breaks options into granted holders and the unallocated pool", async () => {
  const el = await mount(<OwnershipDonut {...drillProps} fullyDilutedShares={1100} />);
  await click(rowFor(el, "Option pool (40 available)"));
  expect(legendRows(el)).toEqual(["Eve60.00%60", "Unallocated pool40.00%40"]);
});

it("groups holders past the sixth into Other holders", async () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    name: `H${i}`,
    security: "Common",
    shares: 100 - i,
  }));
  const el = await mount(<OwnershipDonut {...drillProps} holdings={many} />);
  await click(rowFor(el, "Common"));
  const rows = legendRows(el);
  expect(rows).toHaveLength(6);
  expect(rows[5]).toMatch(/^Other holders\d+\.\d\d%282$/);
});

it("does not open a class without holder data", async () => {
  const el = await mount(
    <OwnershipDonut {...drillProps} holdings={holdings.filter((h) => h.security === "Common")} />,
  );
  expect(rowFor(el, "Common")).not.toBeNull();
  expect(rowFor(el, "Series A Preferred")).toBeNull();
  expect(el.querySelectorAll("[data-testid=donut-slice][role=button]")).toHaveLength(1);
  await click(el.querySelectorAll("[data-testid=donut-slice]")[1]);
  expect(el.querySelector("[data-testid=breakdown]")?.getAttribute("data-open") ?? "false").toBe(
    "false",
  );
});

it("skips transitions and the beam when reduced motion is on", async () => {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") })) as never;
  try {
    const el = await mount(<OwnershipDonut {...drillProps} />);
    await click(rowFor(el, "Common"));
    expect(isOpen(el)).toBe("true");
    const original = el.querySelector<HTMLElement>("[data-testid=donut-original]");
    expect(original?.style.transition).toBe("");
    expect(el.querySelector("[data-testid=donut-projection]")).toBeNull();
  } finally {
    window.matchMedia = original;
  }
});

it("renders nothing without classes", async () => {
  const el = await mount(<OwnershipDonut classes={[]} fullyDilutedShares={null} />);
  expect(el.innerHTML).toBe("");
});
