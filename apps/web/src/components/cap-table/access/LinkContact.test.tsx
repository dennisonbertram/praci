// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { demoRequest } from "./fixtures";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({
  contacts: { list: vi.fn() },
  equity: { accessHolders: { linkContact: vi.fn() } },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: rpcMock }));

import { LinkContact } from "./LinkContact";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  rpcMock.contacts.list.mockReset().mockResolvedValue([
    { id: "c2", name: "Blue IR", email: "ir@blue.test", kind: "investor" },
    { id: "c3", name: "Taken", email: null, kind: "investor" },
  ]);
  rpcMock.equity.accessHolders.linkContact
    .mockReset()
    .mockResolvedValue({ ...demoRequest, contactId: "c2" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("offers only free investor contacts and links the chosen one", async () => {
  const onLinked = vi.fn();
  await act(async () =>
    root.render(
      <LinkContact
        holder={{ ...demoRequest, contactId: null }}
        linkedContactIds={new Set(["c3"])}
        open
        onOpenChange={() => undefined}
        onLinked={onLinked}
      />,
    ),
  );
  expect(rpcMock.contacts.list).toHaveBeenCalledWith({ kind: "investor" });
  const select = document.querySelector('[aria-label="Investor contact"]') as HTMLSelectElement;
  expect([...select.options].map((o) => o.value)).toEqual(["", "c2"]);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, "c2");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const save = [...document.querySelectorAll("button")].find((b) => b.textContent === "Save")!;
  await act(async () => save.click());
  expect(rpcMock.equity.accessHolders.linkContact).toHaveBeenCalledWith({
    stakeholderId: demoRequest.stakeholderId,
    contactId: "c2",
  });
  expect(onLinked).toHaveBeenCalled();
});
