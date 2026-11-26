// @vitest-environment jsdom

import type { UiBlock } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { resetHideAmountsMemory, setHideAmounts } from "../lib/hide-amounts-preference";
import { UiBlockView } from "./UiBlockView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const show = (block: UiBlock) => act(() => root.render(<UiBlockView block={block} />));

afterEach(() => {
  resetHideAmountsMemory();
  act(() => root.render(null));
});

const table: UiBlock = {
  type: "table",
  title: "Spend",
  columns: [{ label: "Name" }, { label: "Total", align: "right" }],
  rows: [["Software", "$4,210.00"]],
};

it("renders a table with headers and cells", () => {
  show(table);
  expect(host.querySelectorAll("th")).toHaveLength(2);
  expect(host.querySelector("td:last-child")?.textContent).toBe("$4,210.00");
  expect(host.textContent).toContain("Spend");
});

it("masks amounts while they are hidden", () => {
  setHideAmounts(true);
  show(table);
  expect(host.textContent).not.toContain("4,210");
});

it("opens https card links in a new tab with no opener, and renders a callout", () => {
  show({ type: "cards", cards: [{ title: "Notes", href: "https://example.com/n" }] });
  const link = host.querySelector("a");
  expect(link?.getAttribute("target")).toBe("_blank");
  expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  show({ type: "callout", tone: "warning", title: "Careful", body: "Check **this**" });
  expect(host.querySelector("strong")?.textContent).toBe("this");
});

it("keeps links in a card's body above the card-wide link", () => {
  show({
    type: "cards",
    cards: [
      {
        title: "Notes",
        href: "https://example.com/n",
        body: "See [the doc](https://example.com/d)",
      },
    ],
  });
  const links = [...host.querySelectorAll("a")];
  expect(links.map((a) => a.getAttribute("href"))).toEqual([
    "https://example.com/n",
    "https://example.com/d",
  ]);
  // The title link stretches over the card; the body link must sit above it.
  expect(links[0]?.className).toContain("after:absolute");
  expect(links[1]?.closest('[class*="[&_a]:z-10"]')).not.toBeNull();
});
