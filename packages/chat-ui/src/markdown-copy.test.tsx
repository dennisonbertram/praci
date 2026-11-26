// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatMarkdown } from "./markdown.web";

async function renderCopy(markdown: string) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const writeText = vi.fn(async (_text: string) => undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ChatMarkdown>{markdown}</ChatMarkdown>);
  });
  return { container, writeText };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("markdown copy buttons", () => {
  it("copies a quote's paragraphs and list as the source text without the quote marks", async () => {
    const { container, writeText } = await renderCopy(
      "Intro\n\n> First paragraph.\n>\n> Second paragraph.\n>\n> - one\n> - two\n> 1. three\n\nAfter",
    );
    const button = container.querySelector<HTMLButtonElement>("blockquote + button");
    expect(button?.getAttribute("aria-label")).toBe("Copy");
    await act(async () => button?.click());
    expect(writeText).toHaveBeenCalledWith(
      "First paragraph.\n\nSecond paragraph.\n\n- one\n- two\n1. three",
    );
    expect(button?.getAttribute("aria-label")).toBe("Copied");
  });

  it("copies a code block exactly", async () => {
    const { container, writeText } = await renderCopy("```\nline one\n  - indented\n\nlast\n```");
    const button = container.querySelector<HTMLButtonElement>("pre + button");
    expect(button?.getAttribute("aria-label")).toBe("Copy");
    await act(async () => button?.click());
    expect(writeText).toHaveBeenCalledWith("line one\n  - indented\n\nlast\n");
    expect(button?.getAttribute("aria-label")).toBe("Copied");
  });
});
