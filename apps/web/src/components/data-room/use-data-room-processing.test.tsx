// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: parts }, ...values),
  plural: (n: number, o: { one: string; other: string }) =>
    (n === 1 ? o.one : o.other).replace("#", String(n)),
}));

const processing = vi.fn();
vi.mock("../../lib/rpc", () => ({ rpc: { dataRoom: { processing: () => processing() } } }));

import { DATA_ROOM_CHANGED } from "../../lib/data-room";
import { useDataRoomProcessing } from "./use-data-room-processing";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const stuck = { reading: 1, indexing: 0, tagging: 0, failed: 0, current: "a.pdf" };
let container: HTMLDivElement;
let root: Root;
function Probe() {
  useDataRoomProcessing();
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  processing.mockReset();
});

it("polls only the processing endpoint while a file is stuck, and reloads lists when counts move", async () => {
  processing.mockResolvedValue(stuck);
  const changed = vi.fn();
  window.addEventListener(DATA_ROOM_CHANGED, changed);
  await act(async () => root.render(<Probe />));
  expect(processing).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  // 3 ticks in 30 s, none of which asks the page to reload its lists.
  expect(processing).toHaveBeenCalledTimes(4);
  expect(changed).not.toHaveBeenCalled();
  processing.mockResolvedValue({ ...stuck, reading: 0, failed: 1 });
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener(DATA_ROOM_CHANGED, changed);
});
