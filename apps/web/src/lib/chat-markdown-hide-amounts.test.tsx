// @vitest-environment jsdom

import { ChatMarkdown, MarkdownTextTransformContext } from "@rakazo/chat-ui/web";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { maskCurrencyText } from "./hide-amounts-preference";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(hidden: boolean, text: string) {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <MarkdownTextTransformContext.Provider value={hidden ? maskCurrencyText : null}>
        <ChatMarkdown>{text}</ChatMarkdown>
      </MarkdownTextTransformContext.Provider>,
    ),
  );
  return el;
}

const text = "You spent **$73,781.83** on 12 transactions: `$99,999` [site](https://x.test/1234)";

it("masks currency in bot text when hidden but not code, counts or link URLs", async () => {
  const el = await render(true, text);
  expect(el.textContent).not.toContain("73,781");
  expect(el.textContent).toContain("12 transactions");
  expect(el.textContent).toContain("$99,999"); // code span untouched
  expect(el.querySelector("a")?.getAttribute("href")).toBe("https://x.test/1234");
});

it("shows the amount when shown", async () => {
  expect((await render(false, text)).textContent).toContain("$73,781.83");
});
