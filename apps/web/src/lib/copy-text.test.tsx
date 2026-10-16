// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useCopyText } from "./copy-text";

afterEach(() => vi.unstubAllGlobals());

it("clears copied when a later copy fails during the confirmation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("no"));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  let state!: ReturnType<typeof useCopyText>;
  function Probe() {
    state = useCopyText();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => state[1]("a"));
  expect(state[0]).toBe(true);
  await act(async () => state[1]("b"));
  expect(state[0]).toBe(false);
  await act(async () => root.unmount());
});
