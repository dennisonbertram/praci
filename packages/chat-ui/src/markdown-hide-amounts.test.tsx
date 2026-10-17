// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { HideAmountsContext } from "./markdown";
import { ChatMarkdown, LinkifiedText } from "./markdown.web";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
afterEach(() => act(() => root.render(null)));

const show = (hidden: boolean, node: React.ReactNode) =>
  act(async () =>
    root.render(<HideAmountsContext.Provider value={hidden}>{node}</HideAmountsContext.Provider>),
  );
const everything = () => el.innerHTML + el.textContent;

const text = [
  'You spent $**73,781.83** on 12 transactions: `$99,999` ![Revenue $55,555](https://x.test/a.png) [site](https://x.test/1234 "$44,444 tip")',
  "",
  "```",
  "total $88,888",
  "```",
  "",
  "| Item | Cost |",
  "| --- | --- |",
  "| A | $11,111.11 |",
  "| B | $22,222.22 |",
].join("\n");

it("masks amounts everywhere in bot markdown, including bold splits, code, alt, title and tables", async () => {
  await show(true, <ChatMarkdown>{text}</ChatMarkdown>);
  for (const real of ["73,781", "99,999", "55,555", "44,444", "88,888", "11,111", "22,222"])
    expect(everything()).not.toContain(real);
  expect(el.textContent).toContain("12 transactions");
  expect(el.querySelector("a")?.getAttribute("href")).toBe("https://x.test/1234");
});

it("re-masks a table's tooltips and exports when the switch flips after first render", async () => {
  const table = "| Item | Cost |\n| --- | --- |\n| A | $11,111.11 |";
  await show(false, <ChatMarkdown>{table}</ChatMarkdown>);
  expect(everything()).toContain("11,111.11");
  await show(true, <ChatMarkdown>{table}</ChatMarkdown>);
  expect(everything()).not.toContain("11,111");
});

it("masks a sent user message", async () => {
  await show(true, <LinkifiedText>{"Spent $73,781.83 see https://x.test/9"}</LinkifiedText>);
  expect(everything()).not.toContain("73,781");
  expect(el.textContent).toContain("x.test/9");
});

it("shows the amount when shown", async () => {
  await show(false, <ChatMarkdown>{"You spent **$73,781.83**"}</ChatMarkdown>);
  expect(el.textContent).toContain("$73,781.83");
});
