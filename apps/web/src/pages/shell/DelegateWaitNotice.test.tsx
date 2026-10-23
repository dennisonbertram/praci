// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DelegateWaitNotice } from "./DelegateWaitNotice";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sent = (minutes: number) => [
  {
    createdAt: new Date(Date.now() - minutes * 60_000).toISOString(),
    blocks: [
      {
        kind: "bot_message_sent" as const,
        toBotId: "b",
        toBotName: "Inbox agent",
        text: "Email",
        intent: "request" as const,
      },
    ],
  },
];

async function render(minutes: number) {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(<DelegateWaitNotice messages={sent(minutes)} />));
  return { host };
}

it("is silent at first, then names the wait, then says it has not answered", async () => {
  expect((await render(0.2)).host.textContent).toBe("");
  expect((await render(2)).host.textContent).toContain("Inbox agent");
  const { host } = await render(6);
  expect(host.textContent).toContain("has not answered");
  expect(host.querySelector("button")).toBeNull();
});
