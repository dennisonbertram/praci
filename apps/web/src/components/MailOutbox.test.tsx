// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./ComposeEmail", () => ({ ComposeEmail: () => null }));

import { holdSend, UNDO_SEND_MS } from "../lib/outbox";
import type { ComposeRestore } from "./ComposeEmail";
import { MailOutbox } from "./MailOutbox";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

it("never shows Sending without an Undo: the notice waits for Sent", async () => {
  let finish: (problem: string | null) => void = () => {};
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<MailOutbox />));
  await act(async () =>
    holdSend(() => new Promise((resolve) => (finish = resolve)), {
      clientId: "abcdefgh",
    } as ComposeRestore),
  );
  expect(document.body.textContent).toContain("Sending…");
  expect(document.body.textContent).toContain("Undo");
  await act(async () => void (await vi.advanceTimersByTimeAsync(UNDO_SEND_MS)));
  expect(document.body.textContent).not.toContain("Sending…");
  await act(async () => finish(null));
  expect(document.body.textContent).toContain("Sent");
  await act(async () => void (await vi.advanceTimersByTimeAsync(5_000)));
  act(() => root.unmount());
});
