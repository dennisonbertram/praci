// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: String.raw }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: String.raw }));
vi.mock("@rakazo/chat-ui/web", () => ({ ChatMarkdown: () => null }));

import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const secretAsk = (text: string): AskBlock => ({
  kind: "ask",
  text,
  input: "secret",
  purpose: "api_key",
  credential: {
    name: "EXAMPLE_API_KEY",
    origin: "https://api.example.com",
    auth: { type: "bearer" },
  },
  status: "pending",
});

it.each([
  ["a look-alike host", "Key for billing.api.example.com.evil.test please"],
  ["a markdown link to the origin", "Key for [the API](https://api.example.com)"],
  ["no mention of the host", "Key for the weekly report"],
])("always shows the real destination when the question has %s", (_name, text) => {
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(<AskCard block={secretAsk(text)} canAnswer onAnswer={vi.fn()} />),
  );
  expect(container.querySelector('[data-testid="secret-ask-destination"]')?.textContent).toBe(
    "https://api.example.com",
  );
});
