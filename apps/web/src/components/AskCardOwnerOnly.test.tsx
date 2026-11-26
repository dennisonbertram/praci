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

const credentialAsk: AskBlock = {
  kind: "ask",
  text: "Secret",
  input: "secret",
  purpose: "api_key",
  credential: {
    name: "EXAMPLE_API_KEY",
    origin: "https://api.example.test",
    auth: { type: "bearer" },
  },
  status: "pending",
};

const render = (block: AskBlock, ownerOnly: boolean) => {
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(
      <AskCard block={block} canAnswer ownerOnly={ownerOnly} onAnswer={vi.fn()} />,
    ),
  );
  return container;
};

it("shows a credential card without a way to provide it to anyone but the run's user", () => {
  const others = render(credentialAsk, true);
  expect(others.querySelectorAll("button")).toHaveLength(0);
  expect(others.textContent).toContain("https://api.example.test");
  expect(others.textContent).not.toContain("No longer active");
  expect(render(credentialAsk, false).querySelectorAll("button").length).toBeGreaterThan(0);
});

it("keeps a connector code card open to others in the chat", () => {
  const code: AskBlock = {
    kind: "ask",
    text: "Code",
    input: "secret",
    purpose: "otp",
    status: "pending",
  };
  expect(render(code, true).querySelectorAll("button").length).toBeGreaterThan(0);
});
