// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({ rpc: {} }));

import { ContactNotice } from "./ContactNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("scrolls a notice without Undo to the end so it does not cover the last row", async () => {
  const scroller = document.createElement("div");
  Object.defineProperty(scroller, "scrollHeight", { value: 900 });
  document.body.append(scroller);
  const root = createRoot(scroller);
  await act(async () =>
    root.render(<ContactNotice notice={{ text: "Restored Ada" }} onDismiss={() => {}} />),
  );
  expect(scroller.scrollTop).toBe(900);
  root.unmount();
  scroller.remove();
});
