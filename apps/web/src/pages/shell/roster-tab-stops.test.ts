// @vitest-environment jsdom

import type { KeyboardEvent } from "react";
import { beforeEach, expect, it } from "vitest";
import { moveRosterFocus, syncRosterTabStops } from "./roster-tab-stops";

let root: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  root.innerHTML = ["a", "b", "c"]
    .map(
      (id) =>
        `<div data-roster-item="${id}"><button data-roster-row="${id}" tabindex="0"${id === "b" ? ' aria-current="page"' : ""}></button><button data-roster-actions="" tabindex="0"></button></div>`,
    )
    .join("");
  document.body.append(root);
});

const tabbable = () =>
  [...root.querySelectorAll<HTMLElement>("button")].filter((b) => b.tabIndex >= 0);

it("leaves two tab stops for the whole list: the open chat's row and its Actions", () => {
  syncRosterTabStops(root, null);
  expect(
    tabbable().map((b) => b.closest("[data-roster-item]")?.getAttribute("data-roster-item")),
  ).toEqual(["b", "b"]);
  // The last focused row wins over the open chat; an id that is gone falls back.
  syncRosterTabStops(root, "c");
  expect(tabbable()[0]?.dataset.rosterRow).toBe("c");
  syncRosterTabStops(root, "gone");
  expect(tabbable()[0]?.dataset.rosterRow).toBe("b");
});

const key = (name: string, target: HTMLElement, extra: object = {}) => {
  let prevented = false;
  moveRosterFocus(root, {
    key: name,
    target,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    preventDefault: () => {
      prevented = true;
    },
    ...extra,
  } as unknown as KeyboardEvent);
  return prevented;
};

it("moves focus with the arrow keys, Home and End, and stops at the ends", () => {
  const [a, b, c] = [...root.querySelectorAll<HTMLElement>("[data-roster-row]")] as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
  b.focus();
  expect(key("ArrowDown", b)).toBe(true);
  expect(document.activeElement).toBe(c);
  expect(key("ArrowDown", c)).toBe(false);
  expect(key("Home", c)).toBe(true);
  expect(document.activeElement).toBe(a);
  expect(key("End", a)).toBe(true);
  expect(document.activeElement).toBe(c);
});

it("leaves Alt+Arrow (reorder) and a row being lifted alone", () => {
  const b = root.querySelector<HTMLElement>("[data-roster-row=b]") as HTMLElement;
  expect(key("ArrowDown", b, { altKey: true })).toBe(false);
  b.setAttribute("aria-pressed", "true");
  expect(key("ArrowDown", b)).toBe(false);
});
