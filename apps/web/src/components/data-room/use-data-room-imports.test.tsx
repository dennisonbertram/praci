// @vitest-environment jsdom

import type { DataRoomApiImport } from "@rakazo/contracts";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const imports = vi.fn();
vi.mock("../../lib/rpc", () => ({ rpc: { dataRoom: { imports: () => imports() } } }));

import { useDataRoomImports } from "./use-data-room-imports";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = (id: string, finished: boolean) => ({ id, finished }) as DataRoomApiImport;
let container: HTMLDivElement;
let root: Root;
let seen: string[] = [];
function Probe() {
  seen = useDataRoomImports().imports.map((e) => e.id);
  return null;
}
beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  imports.mockReset();
});

it("hides imports that finished before this visit and keeps the ones still running", async () => {
  imports.mockResolvedValue([entry("old", true), entry("live", false)]);
  await act(async () => root.render(<Probe />));
  expect(seen).toEqual(["live"]);
});
