// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const restoredProps = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./ComposeEmail", () => ({
  ComposeEmail: (props: unknown) => {
    restoredProps.current = props;
    return null;
  },
}));

import { getOutbox, holdSend, UNDO_SEND_MS } from "../lib/outbox";
import type { ComposeRestore } from "./ComposeEmail";
import { MailOutbox } from "./MailOutbox";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  restoredProps.current = null;
});

it("keeps a Sending notice, without Undo, from the end of the undo window until Sent", async () => {
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
  // The toaster lifts a pending approval above this notice, so Undo stays tappable.
  expect(document.querySelector("[role=status] [data-toast-avoid]")).not.toBeNull();
  await act(async () => void (await vi.advanceTimersByTimeAsync(UNDO_SEND_MS)));
  expect(document.body.textContent).toContain("Sending…");
  expect(document.body.textContent).not.toContain("Undo");
  await act(async () => finish(null));
  expect(document.body.textContent).toContain("Sent");
  await act(async () => void (await vi.advanceTimersByTimeAsync(5_000)));
  act(() => root.unmount());
});

it("reopens uncertain delivery in the Space that owned the original send", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<MailOutbox />));
  const original = {
    clientId: "abcdefgh",
    spaceId: "space-a",
    deliveryStatus: "uncertain",
    deliveryResolution: "checkSent",
    notice: "Not confirmed as sent.",
  } as ComposeRestore;
  await act(async () => {
    holdSend(
      () =>
        Promise.resolve({
          message: "Not confirmed as sent.",
          uncertain: true,
          deliveryResolution: "checkSent" as const,
        }),
      original,
    );
    await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(getOutbox().restoring).toEqual(original);
  expect(restoredProps.current).toMatchObject({
    restore: original,
    spaceId: "space-a",
  });
  act(() => root.unmount());
});
