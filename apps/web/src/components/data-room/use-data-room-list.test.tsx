// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { dataRoom: { items: { list }, search: vi.fn() } },
  withSpaceHeaders: vi.fn(),
}));

import type { ListQuery } from "./use-data-room-list";
import { useDataRoomList } from "./use-data-room-list";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string) => ({ id, name: id });

it("loadAll returns null when the folder changes before the pages finish", async () => {
  let release: (page: unknown) => void = () => undefined;
  list.mockReset();
  list.mockResolvedValueOnce({ items: [item("a")], nextCursor: "c1" });
  list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  list.mockResolvedValue({ items: [item("b")], nextCursor: null });

  let hook: ReturnType<typeof useDataRoomList> | undefined;
  const Probe = ({ q }: { q: ListQuery }) => {
    hook = useDataRoomList(q);
    return null;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  const query = (folderId: string): ListQuery => ({ query: "", filters: { folderId }, sort: null });
  await act(async () => root.render(<Probe q={query("one")} />));
  let result: unknown = "pending";
  await act(async () => {
    void hook?.loadAll().then((rows) => {
      result = rows;
    });
  });
  await act(async () => root.render(<Probe q={query("two")} />));
  await act(async () => release({ items: [item("z")], nextCursor: null }));
  expect(result).toBeNull();
  act(() => root.unmount());
});
